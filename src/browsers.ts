/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
import * as launchpad from 'launchpad';
import * as wd from 'wd';
import * as promisify from 'promisify-node';
import * as selenium from 'selenium-webdriver';

// Either is fine for selenium-webdriver's purposes.
type Capabilities = (wd.Capabilities | selenium.Capabilities);
type LaunchpadToWebdriver = (browser: launchpad.Browser) => Capabilities;
const LAUNCHPAD_TO_SELENIUM: {[browser: string]: LaunchpadToWebdriver} = {
  chrome:  chrome,
  canary:  chrome,
  firefox: firefox,
  aurora:  firefox,
  ie:      internetExplorer,
  // Until https://code.google.com/p/selenium/issues/detail?id=7933
  safari:  safari,
};

/**
 * @param {Array<string|!Object>} browsers
 * @return {!Array<string>}
 */
export function normalize(browsers: (string | {browserName: string})[]) {
  return (browsers || []).map(function(browser) {
    if (typeof browser === 'string') {
      return browser;
    }
    return (<{browserName: string}>browser).browserName;
  });
}

/**
 * Expands an array of browser identifiers for locally installed browsers into
 * their webdriver capabilities objects.
 *
 * If `names` is empty, or contains `all`, all installed browsers will be used.
 *
 * @param {!Array<string>} names
 * @param {function(*, Array<!Object>)} done
 */
export async function expand(names: string[]) {
  if (names.indexOf('all') !== -1) {
    names = [];
  }

  const unsupported = difference(names, supported());
  if (unsupported.length > 0) {
    throw new Error(
        `The following browsers are unsupported: ${unsupported.join(', ')}. ` +
        `(All supported browsers: ${supported().join(', ')})`
    );
  }

  const installedByName = await detect();
  const installed = Object.keys(installedByName);
  // Opting to use everything?
  if (names.length === 0) {
    names = installed;
  }

  const missing = difference(names, installed);
  if (missing.length > 0) {
    throw new Error(
        `The following browsers were not found: ${missing.join(', ')}. ` +
        `(All installed browsers found: ${installed.join(', ')})`
    );
  }

  return names.map(function(n) { return installedByName[n]; });
}

/**
 * Detects any locally installed browsers that we support.
 *
 * Exported for testabilty in wct.
 */
export async function detect() {
  const launcher = await promisify(launchpad.local)();
  const browsers = await promisify(launcher.browsers)();

  const results: {[browser: string]: Capabilities} = {};
  for (const browser of browsers) {
    if (!LAUNCHPAD_TO_SELENIUM[browser.name]) continue;
    const converter = LAUNCHPAD_TO_SELENIUM[browser.name];
    const wdCapabilities = converter(browser);
    if (wdCapabilities) {
      results[browser.name] = wdCapabilities;
    }
  }

  return results;
}

/**
 * Exported for testabilty in wct.
 *
 * @return A list of local browser names that are supported by
 *     the current environment.
 */
export function supported() {
  return Object.keys(launchpad.local.platform).filter(
      (key) => key in LAUNCHPAD_TO_SELENIUM);
}

// Launchpad -> Selenium

/**
 * @param {!Object} browser A launchpad browser definition.
 * @return {!Object} A selenium capabilities object.
 */
function chrome(browser: launchpad.Browser): Capabilities {
  return {
    'browserName': 'chrome',
    'version':     browser.version.match(/\d+/)[0],
    'chromeOptions': {
      'binary': browser.binPath,
      'args': ['start-maximized']
    },
  };
}

/**
 * @param {!Object} browser A launchpad browser definition.
 * @return {!Object} A selenium capabilities object.
 */
function firefox(browser: launchpad.Browser): Capabilities {
  const version = browser.version.match(/\d+/)[0];
  const capabilities = selenium.Capabilities.firefox();
  capabilities.set('marionette', true);
  capabilities.set('version', version);
  capabilities.set('firefox_binary', browser.binPath);
  return capabilities;
}

/**
 * @param {!Object} browser A launchpad browser definition.
 * @return {!Object} A selenium capabilities object.
 */
function safari(browser: launchpad.Browser): Capabilities {
  // SafariDriver doesn't appear to support custom binary paths. Does Safari?
  return {
    'browserName': 'safari',
    'version':     browser.version,
    // TODO(nevir): TEMPORARY. https://github.com/Polymer/web-component-tester/issues/51
    'safari.options': {
      'skipExtensionInstallation': true,
    },
  };
}

/**
 * @param {!Object} browser A launchpad browser definition.
 * @return {!Object} A selenium capabilities object.
 */
function internetExplorer(browser: launchpad.Browser): Capabilities {
  return {
    'browserName': 'internet explorer',
    'version':     browser.version,
  };
}

/** Filter out all elements from toRemove from source. */
function difference<T>(source: T[], toRemove: T[]): T[] {
  return source.filter((value) => toRemove.indexOf(value) < 0);
}