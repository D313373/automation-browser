"""
Script Executor Module
Handles execution of recorded automation scripts using Selenium with undetected_chromedriver
"""

import logging
import sys
import time
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    NoSuchElementException, 
    TimeoutException,
    WebDriverException
)
from typing import Dict, Any, List, Optional, Union

logger = logging.getLogger(__name__)

class ScriptExecutor:
    def __init__(self, chrome_options=None):
        """
        Initialize the ScriptExecutor with optional Chrome options.
        
        Args:
            chrome_options: Optional ChromeOptions to configure the WebDriver
        """
        self.driver = None
        self.chrome_options = chrome_options or self._get_default_chrome_options()
        
    def _get_default_chrome_options(self):
        """Get default Chrome options with common settings for automation."""
        options = uc.ChromeOptions()
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--disable-extensions')
        options.add_argument('--disable-popup-blocking')
        options.add_argument('--disable-notifications')
        return options
        
    def start_driver(self, headless=False):
        """
        Initialize the WebDriver with the configured options.
        
        Args:
            headless: Whether to run in headless mode
            
        Returns:
            WebDriver: The initialized WebDriver instance
        """
        try:
            if headless:
                self.chrome_options.add_argument('--headless=new')
                
            self.driver = uc.Chrome(
                options=self.chrome_options,
                use_subprocess=True
            )
            self.driver.set_page_load_timeout(30)
            return self.driver
            
        except Exception as e:
            logger.error(f"Failed to initialize WebDriver: {str(e)}")
            raise
    
    def execute_script(self, script_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a recorded automation script.
        
        Args:
            script_data (dict): The recorded script data containing actions
            
        Returns:
            dict: Execution results including success status and any errors
        """
        if not self.driver:
            self.start_driver()
            
        results = {
            'success': True,
            'executed_actions': 0,
            'total_actions': len(script_data.get('actions', [])),
            'errors': [],
            'screenshots': {},
            'execution_time': 0,
            'start_time': time.time(),
            'end_time': None,
            'actions': []
        }
        
        try:
            # Add metadata to results
            results.update({
                'name': script_data.get('name', 'Unnamed Script'),
                'description': script_data.get('description', ''),
                'version': script_data.get('version', '1.0'),
                'created_at': script_data.get('created_at', ''),
                'updated_at': script_data.get('updated_at', '')
            })
            
            # Execute each action in the script
            for index, action in enumerate(script_data.get('actions', []), 1):
                action_type = action.get('type')
                action_result = {
                    'index': index,
                    'type': action_type,
                    'description': action.get('description', ''),
                    'success': False,
                    'start_time': time.time(),
                    'end_time': None,
                    'duration': 0,
                    'error': None,
                    'screenshot': None
                }
                
                try:
                    # Get the appropriate handler for this action type
                    handler = self._get_action_handler(action_type)
                    if not handler:
                        raise ValueError(f"No handler found for action type: {action_type}")
                    
                    # Execute the action
                    logger.info(f"Executing action {index}: {action_type}")
                    result = handler(action)
                    
                    # Update action result
                    action_result.update({
                        'success': bool(result),
                        'end_time': time.time(),
                        'duration': time.time() - action_result['start_time']
                    })
                    
                    # Take a screenshot if the action was successful
                    if action_result['success'] and action.get('take_screenshot', False):
                        try:
                            screenshot_name = f"screenshot_{index}_{action_type}.png"
                            screenshot = self.driver.get_screenshot_as_png()
                            results['screenshots'][screenshot_name] = screenshot
                            action_result['screenshot'] = screenshot_name
                        except Exception as e:
                            logger.warning(f"Failed to take screenshot: {e}")
                    
                    results['executed_actions'] += 1
                    
                except Exception as e:
                    # Handle any errors that occur during action execution
                    error_msg = str(e)
                    logger.error(f"Error executing action {index} ({action_type}): {error_msg}", exc_info=True)
                    
                    action_result.update({
                        'success': False,
                        'end_time': time.time(),
                        'duration': time.time() - action_result['start_time'],
                        'error': error_msg
                    })
                    
                    # Take a screenshot on error
                    try:
                        screenshot_name = f"error_{index}_{action_type}.png"
                        screenshot = self.driver.get_screenshot_as_png()
                        results['screenshots'][screenshot_name] = screenshot
                        action_result['screenshot'] = screenshot_name
                    except Exception as screenshot_error:
                        logger.warning(f"Failed to take error screenshot: {screenshot_error}")
                    
                    # Add to errors list
                    results['errors'].append({
                        'action': action,
                        'error': error_msg,
                        'action_index': index,
                        'timestamp': time.time()
                    })
                    
                    # Check if we should continue on error
                    if action.get('continue_on_error', True) is False:
                        logger.info(f"Stopping execution due to error in action {index} (continue_on_error=False)")
                        break
                
                finally:
                    # Ensure end time is set
                    if action_result['end_time'] is None:
                        action_result['end_time'] = time.time()
                        action_result['duration'] = action_result['end_time'] - action_result['start_time']
                    
                    # Add to results
                    results['actions'].append(action_result)
            
            # Update final results
            results.update({
                'end_time': time.time(),
                'execution_time': time.time() - results['start_time'],
                'success': len(results['errors']) == 0,
                'completion_percentage': (results['executed_actions'] / results['total_actions'] * 100) if results['total_actions'] > 0 else 100
            })
            
            return results
            
        except Exception as e:
            # Handle any unexpected errors
            error_msg = f"Unexpected error during script execution: {str(e)}"
            logger.error(error_msg, exc_info=True)
            
            results.update({
                'end_time': time.time(),
                'execution_time': time.time() - results['start_time'],
                'success': False,
                'error': error_msg
            })
            
            return results
    
    def _get_action_handler(self, action_type: str):
        """Get the appropriate handler for the given action type."""
        handlers = {
            'navigate': self._handle_navigate,
            'go_to_url': self._handle_navigate,  # Alias for navigate
            'click': self._handle_click,
            'input': self._handle_input,
            'type': self._handle_input,  # Alias for input
            'select': self._handle_select,
            'wait': self._handle_wait,
            'sleep': self._handle_wait,  # Alias for wait
            'execute_js': self._handle_execute_js,
            'js': self._handle_execute_js,  # Alias for execute_js
            'switch_to_window': self._handle_switch_window,
            'key_down': self._handle_key_down,
            'key_up': self._handle_key_up,
            'type_credential': self._handle_type_credential,
            'tab': self._handle_tab,
            'click_coordinates': self._handle_click_coordinates,
            'switch_to_default_content': self._handle_switch_default_content,
            'move_to_element': self._handle_move_to_element,
            'double_click': self._handle_double_click,
            'right_click': self._handle_right_click,
            'drag_and_drop': self._handle_drag_and_drop,
            'scroll_to': self._handle_scroll_to,
            'hover': self._handle_hover,
            'refresh': self._handle_refresh,
            'back': self._handle_back,
            'forward': self._handle_forward,
            'accept_alert': self._handle_accept_alert,
            'dismiss_alert': self._handle_dismiss_alert,
            'switch_to_frame': self._handle_switch_to_frame,
            'switch_to_parent_frame': self._handle_switch_to_parent_frame,
            'execute_async_js': self._handle_execute_async_js,
            'set_window_size': self._handle_set_window_size,
            'maximize_window': self._handle_maximize_window,
            'minimize_window': self._handle_minimize_window,
            'fullscreen_window': self._handle_fullscreen_window,
            'take_screenshot': self._handle_take_screenshot,
            'save_screenshot': self._handle_save_screenshot,
            'set_cookie': self._handle_set_cookie,
            'delete_cookie': self._handle_delete_cookie,
            'delete_all_cookies': self._handle_delete_all_cookies,
            'get_cookies': self._handle_get_cookies,
            'get_cookie': self._handle_get_cookie,
            'add_cookie': self._handle_add_cookie,
            'execute_in_frame': self._handle_execute_in_frame,
            'wait_for_element': self._handle_wait_for_element,
            'wait_for_element_visible': self._handle_wait_for_element_visible,
            'wait_for_element_clickable': self._handle_wait_for_element_clickable,
            'wait_for_element_invisible': self._handle_wait_for_element_invisible,
            'wait_for_page_load': self._handle_wait_for_page_load,
            'wait_for_ajax': self._handle_wait_for_ajax,
            'wait_for_angular': self._handle_wait_for_angular,
            'wait_for_jquery': self._handle_wait_for_jquery,
            'wait_for_js_condition': self._handle_wait_for_js_condition,
            'wait_for_url': self._handle_wait_for_url,
            'wait_for_url_contains': self._handle_wait_for_url_contains,
            'wait_for_title': self._handle_wait_for_title,
            'wait_for_title_contains': self._handle_wait_for_title_contains,
            'wait_for_alert': self._handle_wait_for_alert,
            'wait_for_alert_text': self._handle_wait_for_alert_text,
            'wait_for_alert_text_contains': self._handle_wait_for_alert_text_contains,
            'wait_for_alert_not_present': self._handle_wait_for_alert_not_present
        }
        return handlers.get(action_type)

    def _handle_navigate(self, action: Dict[str, Any]) -> bool:
        """Handle navigation actions."""
        url = action.get('url')
        if not url:
            raise ValueError("No URL provided for navigation action")
            
        logger.info(f"Navigating to: {url}")
        self.driver.get(url)
        
        # Wait for page to load
        WebDriverWait(self.driver, 30).until(
            lambda d: d.execute_script('return document.readyState') == 'complete'
        )
        return True
        
    def _handle_wait_for_jquery(self, action: Dict[str, Any]) -> None:
        """Wait for jQuery to be loaded and all jQuery AJAX requests to complete."""
        timeout = action.get('timeout', 10)  # Default 10 seconds timeout
        wait = WebDriverWait(self.driver, timeout)
        
        # Wait for jQuery to be loaded
        wait.until(
            lambda d: d.execute_script(
                'return (typeof jQuery !== "undefined") && jQuery.active === 0;'
            ),
            message="Timed out waiting for jQuery to be ready"
        )
        
        # Wait for all AJAX requests to complete
        wait.until(
            lambda d: d.execute_script(
                'return (typeof jQuery === "undefined") || (jQuery.active === 0);'
            ),
            message="Timed out waiting for AJAX requests to complete"
        )
        
    def _handle_execute_in_frame(self, action: Dict[str, Any]) -> None:
        """
        Execute actions within an iframe context.
        
        Args:
            action (dict): The action containing frame locator and nested actions
        """
        frame_locator = action.get('frame_locator')
        actions = action.get('actions', [])
        
        if not frame_locator or not actions:
            return
            
        try:
            # Switch to the specified frame
            if frame_locator.get('type') == 'index':
                self.driver.switch_to.frame(frame_locator['value'])
            else:
                frame_element = self._find_element({'locators': [frame_locator]})
                self.driver.switch_to.frame(frame_element)
            
            # Execute each action in the frame context
            for action_item in actions:
                action_type = action_item.get('type')
                handler = self._get_action_handler(action_type)
                if handler:
                    handler(action_item)
                    
        except Exception as e:
            logger.error(f"Error executing actions in frame: {e}")
            raise
            
        finally:
            # Always switch back to default content
            self.driver.switch_to.default_content()

    def _handle_click(self, action: Dict[str, Any]) -> bool:
        """Handle click actions with multiple locator fallbacks."""
        locators = action.get('locators', [])
        x = action.get('x')
        y = action.get('y')
        element = None
        
        # Try locators first
        if locators:
            for locator in locators:
                try:
                    locator_type_str, locator_value = locator
                    locator_type = {
                        'ID': By.ID,
                        'XPATH': By.XPATH,
                        'CSS_SELECTOR': By.CSS_SELECTOR,
                        'CLASS_NAME': By.CLASS_NAME,
                        'NAME': By.NAME,
                        'LINK_TEXT': By.LINK_TEXT,
                        'PARTIAL_LINK_TEXT': By.PARTIAL_LINK_TEXT,
                        'TAG_NAME': By.TAG_NAME
                    }.get(locator_type_str.upper())
                    
                    if not locator_type:
                        continue
                        
                    element = WebDriverWait(self.driver, 5).until(
                        EC.element_to_be_clickable((locator_type, locator_value))
                    )
                    
                    # Add small random offset to avoid detection
                    actions = ActionChains(self.driver)
                    actions.move_to_element_with_offset(element, 1, 1).click().perform()
                    logger.info(f"Clicked element with {locator_type_str}='{locator_value}'")
                    return True
                    
                except (NoSuchElementException, TimeoutException):
                    continue
                except Exception as e:
                    logger.warning(f"Error clicking element: {e}")
                    continue
        
        # Fallback to coordinates if no locators were provided or all failed
        if element is None and x is not None and y is not None:
            try:
                actions = ActionChains(self.driver)
                actions.move_by_offset(x, y).click().perform()
                logger.info(f"Clicked at coordinates ({x}, {y})")
                return True
            except Exception as e:
                logger.error(f"Failed to click at coordinates: {e}")
                raise
                
        if element is None:
            raise NoSuchElementException("Could not find element with provided locators")
            
        return False

    def _handle_input(self, action: Dict[str, Any]) -> bool:
        """Handle text input actions with proper clearing and typing."""
        element = self._find_element(action)
        text = action.get('text', '')
        clear_first = action.get('clear_first', True)
        
        try:
            if clear_first:
                # Clear existing text with keyboard shortcut
                element.send_keys(Keys.COMMAND + 'a' if sys.platform == 'darwin' else Keys.CONTROL + 'a')
                element.send_keys(Keys.DELETE)
            
            # Type the text with a small delay between characters
            for char in text:
                element.send_keys(char)
                time.sleep(0.01)  # Small delay to mimic human typing
                
            return True
            
        except Exception as e:
            logger.error(f"Error entering text: {e}")
            raise

    def _handle_select(self, action: Dict[str, Any]) -> bool:
        """Handle dropdown select actions."""
        from selenium.webdriver.support.ui import Select
        
        element = self._find_element(action)
        select = Select(element)
        
        try:
            if 'value' in action:
                select.select_by_value(action['value'])
            elif 'index' in action:
                select.select_by_index(action['index'])
            elif 'visible_text' in action:
                select.select_by_visible_text(action['visible_text'])
            else:
                raise ValueError("No valid selection criteria provided for select action")
                
            return True
            
        except Exception as e:
            logger.error(f"Error selecting option: {e}")
            raise

    def _handle_wait(self, action: Dict[str, Any]) -> bool:
        """Handle wait actions with time in seconds."""
        wait_time = float(action.get('time', 1))  # Default 1 second
        time.sleep(wait_time)
        return True

    def _get_by_from_string(self, locator_type_str: str) -> Optional[str]:
        """Convert a string locator type to a By constant."""
        return {
            'ID': By.ID,
            'XPATH': By.XPATH,
            'CSS_SELECTOR': By.CSS_SELECTOR,
            'CLASS_NAME': By.CLASS_NAME,
            'NAME': By.NAME,
            'LINK_TEXT': By.LINK_TEXT,
            'PARTIAL_LINK_TEXT': By.PARTIAL_LINK_TEXT,
            'TAG_NAME': By.TAG_NAME
        }.get(locator_type_str.upper())

    def _find_element_with_wait(self, action: Dict[str, Any], condition):
        """Find an element with an explicit wait condition."""
        locators = action.get('locators', [])
        timeout = action.get('timeout', 10)

        if not locators:
            raise ValueError("No locators provided for wait action")

        for locator_type_str, locator_value in locators:
            by = self._get_by_from_string(locator_type_str)
            if not by:
                logger.warning(f"Unsupported locator type: {locator_type_str}")
                continue
            
            try:
                wait = WebDriverWait(self.driver, timeout)
                return wait.until(condition((by, locator_value)))
            except (NoSuchElementException, TimeoutException):
                continue
        
        raise NoSuchElementException(f"Element not found with locators: {locators}")

    def _handle_wait_for_element(self, action: Dict[str, Any]) -> bool:
        """Wait for an element to be present in the DOM."""
        self._find_element_with_wait(action, EC.presence_of_element_located)
        return True
        
    def _handle_wait_for_element_visible(self, action: Dict[str, Any]) -> bool:
        """Wait for an element to be visible on the page."""
        self._find_element_with_wait(action, EC.visibility_of_element_located)
        return True
        
    def _handle_wait_for_element_clickable(self, action: Dict[str, Any]) -> bool:
        """Wait for an element to be clickable."""
        self._find_element_with_wait(action, EC.element_to_be_clickable)
        return True
        
    def _handle_wait_for_element_invisible(self, action: Dict[str, Any]) -> bool:
        """Wait for an element to be invisible or not present in the DOM."""
        locators = action.get('locators', [])
        timeout = action.get('timeout', 10)

        if not locators:
            raise ValueError("No locators provided for wait_for_element_invisible")

        # For invisibility, we only need one locator.
        locator_type_str, locator_value = locators[0]
        by = self._get_by_from_string(locator_type_str)
        if not by:
            raise ValueError(f"Unsupported locator type: {locator_type_str}")

        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.invisibility_of_element_located((by, locator_value)))
        return True

    def _handle_wait_for_page_load(self, action: Dict[str, Any]) -> bool:
        """Wait for the page to finish loading."""
        timeout = action.get('timeout', 30)
        wait = WebDriverWait(self.driver, timeout)
        wait.until(lambda d: d.execute_script('return document.readyState') == 'complete')
        return True

    def _handle_wait_for_ajax(self, action: Dict[str, Any]) -> bool:
        """Wait for all AJAX requests to complete (requires jQuery)."""
        timeout = action.get('timeout', 10)
        wait = WebDriverWait(self.driver, timeout)
        wait.until(
            lambda d: d.execute_script('return (typeof jQuery === "undefined") || (jQuery.active === 0);'),
            message="Timed out waiting for AJAX requests to complete"
        )
        return True

    def _handle_wait_for_angular(self, action: Dict[str, Any]) -> bool:
        """Wait for Angular to finish rendering."""
        timeout = action.get('timeout', 10)
        script = '''
            return (typeof angular === 'undefined') || 
                   (angular.element(document).injector().get('$http').pendingRequests.length === 0);
        '''
        wait = WebDriverWait(self.driver, timeout)
        wait.until(lambda d: d.execute_script(script), message="Timed out waiting for Angular to be ready")
        return True

    def _handle_wait_for_js_condition(self, action: Dict[str, Any]) -> bool:
        """Wait for a JavaScript condition to return true."""
        script = action.get('script')
        timeout = action.get('timeout', 10)
        if not script:
            raise ValueError("No script provided for wait_for_js_condition")
        
        wait = WebDriverWait(self.driver, timeout)
        wait.until(lambda d: d.execute_script(script), message=f"Timed out waiting for JS condition: {script}")
        return True

    def _handle_wait_for_url(self, action: Dict[str, Any]) -> bool:
        """Wait for the URL to match a specific value."""
        url = action.get('url')
        timeout = action.get('timeout', 10)
        if not url:
            raise ValueError("No URL provided for wait_for_url")
        
        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.url_to_be(url))
        return True

    def _handle_wait_for_url_contains(self, action: Dict[str, Any]) -> bool:
        """Wait for the URL to contain a specific substring."""
        substring = action.get('substring')
        timeout = action.get('timeout', 10)
        if not substring:
            raise ValueError("No substring provided for wait_for_url_contains")
        
        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.url_contains(substring))
        return True

    def _handle_wait_for_title(self, action: Dict[str, Any]) -> bool:
        """Wait for the page title to match a specific value."""
        title = action.get('title')
        timeout = action.get('timeout', 10)
        if not title:
            raise ValueError("No title provided for wait_for_title")
        
        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.title_is(title))
        return True

    def _handle_wait_for_title_contains(self, action: Dict[str, Any]) -> bool:
        """Wait for the page title to contain a specific substring."""
        substring = action.get('substring')
        timeout = action.get('timeout', 10)
        if not substring:
            raise ValueError("No substring provided for wait_for_title_contains")
        
        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.title_contains(substring))
        return True

    def _handle_wait_for_alert(self, action: Dict[str, Any]) -> bool:
        """Wait for an alert to be present."""
        timeout = action.get('timeout', 10)
        wait = WebDriverWait(self.driver, timeout)
        wait.until(EC.alert_is_present())
        return True

    def _handle_wait_for_alert_text(self, action: Dict[str, Any]) -> bool:
        """Wait for an alert with specific text to be present."""
        text = action.get('text')
        timeout = action.get('timeout', 10)
        if not text:
            raise ValueError("No text provided for wait_for_alert_text")
        
        self._handle_wait_for_alert(action)
        alert = self.driver.switch_to.alert
        if alert.text == text:
            return True
        else:
            raise TimeoutException(f"Alert text did not match. Expected: '{text}', Actual: '{alert.text}'")

    def _handle_wait_for_alert_text_contains(self, action: Dict[str, Any]) -> bool:
        """Wait for an alert with text containing a substring."""
        substring = action.get('substring')
        timeout = action.get('timeout', 10)
        if not substring:
            raise ValueError("No substring provided for wait_for_alert_text_contains")
        
        self._handle_wait_for_alert(action)
        alert = self.driver.switch_to.alert
        if substring in alert.text:
            return True
        else:
            raise TimeoutException(f"Alert text did not contain substring. Substring: '{substring}', Actual: '{alert.text}'")

    def _handle_wait_for_alert_not_present(self, action: Dict[str, Any]) -> bool:
        """Wait for an alert to not be present."""
        timeout = action.get('timeout', 10)
        wait = WebDriverWait(self.driver, timeout)
        wait.until_not(EC.alert_is_present())
        return True

    def _handle_execute_js(self, action: Dict[str, Any]) -> bool:
        """Handle JavaScript execution actions."""
        script = action.get('script')
        if not script:
            raise ValueError("No script provided for execute_js action")
            
        try:
            self.driver.execute_script(script)
            return True
        except Exception as e:
            logger.error(f"Error executing JavaScript: {e}")
            raise

    def _handle_switch_window(self, action: Dict[str, Any]) -> bool:
        """Handle window switching actions."""
        target = action.get('target', 'new')
        
        if target == 'new':
            original_window = self.driver.current_window_handle
            try:
                WebDriverWait(self.driver, 10).until(
                    EC.number_of_windows_to_be(len(self.driver.window_handles) + 1)
                )
            except TimeoutException:
                logger.warning("Timed out waiting for a new window to open.")
                return False
                
            new_window_handles = [h for h in self.driver.window_handles if h != original_window]
            if new_window_handles:
                self.driver.switch_to.window(new_window_handles[0])
                return True
            return False
            
        elif target == 'original':
            if self.driver.window_handles:
                self.driver.switch_to.window(self.driver.window_handles[0])
                return True
            return False
            
        return False

    def _handle_key_down(self, action: Dict[str, Any]) -> bool:
        """Handle key down actions."""
        key = action.get('key')
        if not key:
            raise ValueError("No key provided for key_down action")
            
        try:
            key_constant = getattr(Keys, key.upper(), None)
            if not key_constant:
                raise ValueError(f"Invalid key: {key}")
                
            actions = ActionChains(self.driver)
            actions.key_down(key_constant).perform()
            return True
            
        except Exception as e:
            logger.error(f"Error performing key down: {e}")
            raise

    def _handle_key_up(self, action: Dict[str, Any]) -> bool:
        """Handle key up actions."""
        key = action.get('key')
        if not key:
            raise ValueError("No key provided for key_up action")
            
        try:
            key_constant = getattr(Keys, key.upper(), None)
            if not key_constant:
                raise ValueError(f"Invalid key: {key}")
                
            actions = ActionChains(self.driver)
            actions.key_up(key_constant).perform()
            return True
            
        except Exception as e:
            logger.error(f"Error performing key up: {e}")
            raise

    def _handle_type_credential(self, action: Dict[str, Any]) -> bool:
        """Handle credential typing actions."""
        credential_type = action.get('credential_type')
        credentials = action.get('credentials', {})
        
        if not credential_type or credential_type not in credentials:
            raise ValueError(f"Invalid or missing credential type: {credential_type}")
            
        try:
            active_element = self.driver.switch_to.active_element
            active_element.send_keys(credentials[credential_type])
            return True
            
        except Exception as e:
            logger.error(f"Error typing credential: {e}")
            raise

    def _handle_tab(self, action: Dict[str, Any]) -> bool:
        """Handle tab key press actions."""
        times = int(action.get('times', 1))
        
        try:
            active_element = self.driver.switch_to.active_element
            for _ in range(times):
                active_element.send_keys(Keys.TAB)
            return True
            
        except Exception as e:
            logger.error(f"Error pressing tab: {e}")
            raise

    def _handle_click_coordinates(self, action: Dict[str, Any]) -> bool:
        """Handle click at specific coordinates."""
        x = action.get('x')
        y = action.get('y')
        
        if x is None or y is None:
            raise ValueError("Both x and y coordinates are required")
            
        try:
            actions = ActionChains(self.driver)
            actions.move_by_offset(x, y).click().perform()
            return True
            
        except Exception as e:
            logger.error(f"Error clicking at coordinates: {e}")
            raise

    def _handle_switch_default_content(self, action: Dict[str, Any]) -> bool:
        """Switch back to the default content."""
        try:
            self.driver.switch_to.default_content()
            return True
            
        except Exception as e:
            logger.error(f"Error switching to default content: {e}")
            raise

    # Additional handler methods for other action types...
    # These can be implemented similarly to the ones above
    
    def _handle_move_to_element(self, action: Dict[str, Any]) -> bool:
        """Move to the specified element."""
        element = self._find_element(action)
        actions = ActionChains(self.driver)
        actions.move_to_element(element).perform()
        return True
        
    def _handle_double_click(self, action: Dict[str, Any]) -> bool:
        """Perform a double click on the specified element."""
        element = self._find_element(action)
        actions = ActionChains(self.driver)
        actions.double_click(element).perform()
        return True
        
    def _handle_right_click(self, action: Dict[str, Any]) -> bool:
        """Perform a right click on the specified element."""
        element = self._find_element(action)
        actions = ActionChains(self.driver)
        actions.context_click(element).perform()
        return True
        
    def _handle_drag_and_drop(self, action: Dict[str, Any]) -> bool:
        """Drag an element to a target element."""
        source = self._find_element(action.get('source'))
        target = self._find_element(action.get('target'))
        actions = ActionChains(self.driver)
        actions.drag_and_drop(source, target).perform()
        return True
        
    def _handle_scroll_to(self, action: Dict[str, Any]) -> bool:
        """Scroll to the specified element."""
        element = self._find_element(action)
        self.driver.execute_script("arguments[0].scrollIntoView(true);", element)
        return True
        
    def _handle_hover(self, action: Dict[str, Any]) -> bool:
        """Hover over the specified element."""
        element = self._find_element(action)
        actions = ActionChains(self.driver)
        actions.move_to_element(element).perform()
        return True
        
    def _handle_refresh(self, action: Dict[str, Any]) -> bool:
        """Refresh the current page."""
        self.driver.refresh()
        return True
        
    def _handle_back(self, action: Dict[str, Any]) -> bool:
        """Navigate back in browser history."""
        self.driver.back()
        return True
        
    def _handle_forward(self, action: Dict[str, Any]) -> bool:
        """Navigate forward in browser history."""
        self.driver.forward()
        return True
        
    def _handle_accept_alert(self, action: Dict[str, Any]) -> bool:
        """Accept an alert dialog."""
        self.driver.switch_to.alert.accept()
        return True
        
    def _handle_dismiss_alert(self, action: Dict[str, Any]) -> bool:
        """Dismiss an alert dialog."""
        self.driver.switch_to.alert.dismiss()
        return True
        
    def _handle_switch_to_frame(self, action: Dict[str, Any]) -> bool:
        """Switch to the specified iframe."""
        frame_reference = action.get('frame_reference')
        if frame_reference is None:
            raise ValueError("frame_reference is required for switch_to_frame action")
            
        if isinstance(frame_reference, str):
            # Assume it's a name or id
            self.driver.switch_to.frame(frame_reference)
        else:
            # Assume it's an index
            self.driver.switch_to.frame(frame_reference)
            
        return True
        
    def _handle_switch_to_parent_frame(self, action: Dict[str, Any]) -> bool:
        """Switch to the parent frame."""
        self.driver.switch_to.parent_frame()
        return True
        
    def _handle_execute_async_js(self, action: Dict[str, Any]) -> bool:
        """Execute asynchronous JavaScript."""
        script = action.get('script')
        args = action.get('args', [])
        
        if not script:
            raise ValueError("No script provided for execute_async_js action")
            
        self.driver.execute_async_script(script, *args)
        return True
        
    def _handle_set_window_size(self, action: Dict[str, Any]) -> bool:
        """Set the browser window size."""
        width = action.get('width')
        height = action.get('height')
        
        if width is None or height is None:
            raise ValueError("Both width and height are required for set_window_size action")
            
        self.driver.set_window_size(width, height)
        return True
        
    def _handle_maximize_window(self, action: Dict[str, Any]) -> bool:
        """Maximize the browser window."""
        self.driver.maximize_window()
        return True
        
    def _handle_minimize_window(self, action: Dict[str, Any]) -> bool:
        """Minimize the browser window."""
        self.driver.minimize_window()
        return True
        
    def _handle_fullscreen_window(self, action: Dict[str, Any]) -> bool:
        """Set the browser window to fullscreen."""
        self.driver.fullscreen_window()
        return True
        
    def _handle_take_screenshot(self, action: Dict[str, Any]) -> bool:
        """Take a screenshot of the current window."""
        return self.driver.get_screenshot_as_png()
        
    def _handle_save_screenshot(self, action: Dict[str, Any]) -> bool:
        """Save a screenshot of the current window to a file."""
        filename = action.get('filename', 'screenshot.png')
        self.driver.save_screenshot(filename)
        return True
        
    def _handle_set_cookie(self, action: Dict[str, Any]) -> bool:
        """Set a cookie."""
        name = action.get('name')
        value = action.get('value')
        
        if not name or value is None:
            raise ValueError("Both name and value are required for set_cookie action")
            
        self.driver.add_cookie({'name': name, 'value': value})
        return True
        
    def _handle_delete_cookie(self, action: Dict[str, Any]) -> bool:
        """Delete a cookie by name."""
        name = action.get('name')
        if not name:
            raise ValueError("Name is required for delete_cookie action")
            
        self.driver.delete_cookie(name)
        return True
        
    def _handle_delete_all_cookies(self, action: Dict[str, Any]) -> bool:
        """Delete all cookies."""
        self.driver.delete_all_cookies()
        return True
        
    def _handle_get_cookies(self, action: Dict[str, Any]) -> list:
        """Get all cookies."""
        return self.driver.get_cookies()
        
    def _handle_get_cookie(self, action: Dict[str, Any]) -> dict:
        """Get a cookie by name."""
        name = action.get('name')
        if not name:
            raise ValueError("Name is required for get_cookie action")
            
        return self.driver.get_cookie(name)
        
    def _handle_add_cookie(self, action: Dict[str, Any]) -> bool:
        """Add a cookie."""
        cookie = action.get('cookie')
        if not cookie:
            raise ValueError("Cookie object is required for add_cookie action")
            
        self.driver.add_cookie(cookie)
        return True
    
    def _find_element(self, action):
        """
        Find an element using the provided locator strategy.
        
        Args:
            action (dict): The action containing locator information
            
        Returns:
            WebElement: The found web element
            
        Raises:
            NoSuchElementException: If the element cannot be found
            TimeoutException: If the element is not visible within the timeout
        """
        locators = action.get('locators', [])
        timeout = action.get('timeout', 10)
        
        # Try each locator strategy until one works
        for locator_type, locator_value in locators:
            try:
                if locator_type == 'id':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.ID, locator_value))
                    )
                elif locator_type == 'xpath':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.XPATH, locator_value))
                    )
                elif locator_type == 'css':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.CSS_SELECTOR, locator_value))
                    )
                elif locator_type == 'name':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.NAME, locator_value))
                    )
                elif locator_type == 'class_name':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.CLASS_NAME, locator_value))
                    )
                elif locator_type == 'link_text':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.LINK_TEXT, locator_value))
                    )
                elif locator_type == 'partial_link_text':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.PARTIAL_LINK_TEXT, locator_value))
                    )
                elif locator_type == 'tag_name':
                    return WebDriverWait(self.driver, timeout).until(
                        EC.visibility_of_element_located((By.TAG_NAME, locator_value))
                    )
            except (NoSuchElementException, TimeoutException):
                continue
                
        raise NoSuchElementException(
            f"Could not find element with any of the provided locators: {locators}"
        )
    
    def close(self):
        """Close the WebDriver and clean up resources."""
        if self.driver:
            try:
                self.driver.quit()
            except Exception as e:
                logger.error(f"Error closing WebDriver: {str(e)}")
            finally:
                self.driver = None

    def __enter__(self):
        """Context manager entry."""
        return self
        
    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit - ensures resources are cleaned up."""
        self.close()


def execute_script(script_data, chrome_options=None, headless=False):
    """
    Helper function to execute a script with a single function call.
    
    Args:
        script_data (dict): The recorded script data
        chrome_options: Optional ChromeOptions to configure the WebDriver
        headless (bool): Whether to run in headless mode
        
    Returns:
        dict: Execution results
    """
    with ScriptExecutor(chrome_options) as executor:
        executor.start_driver(headless=headless)
        return executor.execute_script(script_data)
