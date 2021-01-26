/*
* Software Name : abcdesktop.io
* Version: 0.2
* SPDX-FileCopyrightText: Copyright (c) 2020-2021 Orange
* SPDX-License-Identifier: GPL-2.0-only
*
* This software is distributed under the GNU General Public License v2.0 only
* see the "license.txt" file for more details.
*
* Author: abcdesktop.io team
* Software description: cloud native desktop service
*/

import * as system from '../system.js';
import * as launcher from '../launcher.js';

import { settingsEvents } from '../settingsevents.js';

let firstAppear = true;

function getScreenInfos() {
  const navigatorName = document.getElementById('navigator-name');
  const userAgent = document.getElementById('user-agent');
  if (navigatorName) { navigatorName.innerText = navigator.appCodeName; }

  if (userAgent) { userAgent.innerText = navigator.userAgent; }

  const jsScreenWidth = document.getElementById('js-screen-width');
  if (jsScreenWidth) { jsScreenWidth.innerText = `${screen.width}px`; }

  const jsScreenHeight = document.getElementById('js-screen-height');
  if (jsScreenHeight) { jsScreenHeight.innerText = `${screen.height}px`; }

  const jsWindowInnerHeight = document.getElementById('js-window-innerHeight');
  if (jsWindowInnerHeight) { jsWindowInnerHeight.innerText = `${document.documentElement.clientHeight}px`; }

  const jsWindowInnerWidth = document.getElementById('js-window-innerWidth');
  if (jsWindowInnerWidth) { jsWindowInnerWidth.innerText = `${document.documentElement.clientWidth}px`; }

  const jsPixelRatio = document.getElementById('js-pixel-ratio');
  if (jsPixelRatio) { jsPixelRatio.innerText = `${window.devicePixelRatio}px`; }

  const rootFontSize = document.getElementById('root-font-size');
  if (rootFontSize) { rootFontSize.innerText = window.getComputedStyle(document.body, null).getPropertyValue('font-size'); }

  const deviceOrientation = document.getElementById('device-orientation');
  if (deviceOrientation && screen.orientation) {
    deviceOrientation.innerText = screen.orientation.type;
  }
}

function animationLoop() {
  const current = $(this);
  const callBack = current.attr('anim-is-running') === 'false' ? () => {} : animationLoop;

  if (current.attr('down') === 'false') {
    current.attr('down', 'true');
    current.animate({ top: '0px' }, 500, callBack);
  } else {
    current.attr('down', 'false');
    current.animate({ top: '20px' }, 500, callBack);
  }
}

export function init(home, tab) {
  system.hide(home);

  if (!firstAppear) {
    system.show(tab);
    return;
  }

  firstAppear = false;
  system.removeAllChilds(document.getElementById('overview'));

  launcher.getWebModulesVersion()
    .then((version) => {
      const systemTab = document.getElementById('system-tab');
      if (!systemTab) {
        return;
      }

      const settingsServer = systemTab.querySelector('div.settings-server');
      if (!settingsServer) {
        return;
      }

      const paragraphes = settingsServer.querySelectorAll('p');

      if (!(paragraphes instanceof NodeList)) {
        return;
      }

      const [webFrontDate, webFrontVersion] = paragraphes;

      if (!webFrontDate || !webFrontVersion) {
        return;
      }

      webFrontDate.innerText = `Date : ${version.date}`;
      webFrontVersion.innerText = `Version : ${version.version}`;
    })
    .catch(console.error);

  launcher.getPyosVersion()
    .then((version) => {
      if (version.status === 200) {
        const systemTab = document.getElementById('system-tab');
        if (!systemTab) {
          return;
        }

        const settingsServer = systemTab.querySelector('div.settings-server');
        if (!settingsServer) {
          return;
        }

        const paragraphes = settingsServer.querySelectorAll('p');

        if (!(paragraphes instanceof NodeList)) {
          return;
        }

        const apiServerDate = paragraphes[2];
        const apiServerVersion = paragraphes[3];

        if (!apiServerDate || !apiServerVersion) {
          return;
        }

        apiServerDate.innerText = `Date : ${version.date}`;
        apiServerVersion.innerText = `Version : ${version.version}`;
      }
    });

  launcher.getSpawnerVersion()
    .then((version) => {
      const systemTab = document.getElementById('system-tab');
      if (!systemTab) {
        return;
      }

      const settingsServer = systemTab.querySelector('div.settings-server');
      if (!settingsServer) {
        return;
      }

      const paragraphes = settingsServer.querySelectorAll('p');

      if (!(paragraphes instanceof NodeList)) {
        return;
      }

      const spawnerServerDate = paragraphes[4];
      const spawnerServerVersion = paragraphes[5];

      if (!spawnerServerDate || !spawnerServerVersion) {
        return;
      }

      spawnerServerDate.innerText = `Date : ${version.date}`;
      spawnerServerVersion.innerText = `Version : ${version.version}`;
    });

  launcher.about()
    .then((msg) => {
      const overview = tab.querySelector('#overview');
      const fragment = document.createDocumentFragment();
      for (const key in msg) {
        if (!(key in msg)) {
          continue;
        }
        const wrapper = document.createElement('div');
        const spanKey = document.createElement('span');
        const spanValue = document.createElement('span');
        let keyName = key.toLocaleLowerCase().replace(/_/g, ' ');

        wrapper.className = 'row';
        spanKey.className = 'col-xl-4 col-lg-4 col-md-8 col-8';
        spanValue.className = 'col-xl-8 col-lg-8 col-md-4 col-4';

        if (keyName.includes(' ')) {
          keyName = keyName.split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .reduce((prev, cur) => `${prev} ${cur}`, '');
          spanKey.textContent = `${keyName} : `;
          spanValue.textContent = `${msg[key] ? msg[key] : null}`;
        } else {
          spanKey.textContent = `${keyName.charAt(0).toUpperCase() + key.slice(1)} : `;
          spanValue.textContent = `${msg[key] ? msg[key] : null}`;
        }
        wrapper.appendChild(spanKey);
        wrapper.appendChild(spanValue);
        fragment.appendChild(wrapper);
      }
      overview.appendChild(fragment);
    });

  // Display
  getScreenInfos();

  $('.logo-animation')
    .each(function () {
      const current = $(this);
      current.attr('anim-is-running', 'false');
      current.click(() => {
        if (current.attr('anim-is-running') === 'false') {
          current.attr('anim-is-running', 'true');
          current.attr('down', 'false');
          current.animate({ top: '20px' }, 500, animationLoop);
        } else {
          current.attr('anim-is-running', 'false');
          current.attr('down', 'false');
        }
      });
    });
  system.show(tab);
}

window.addEventListener('resize', getScreenInfos);

settingsEvents.addEventListener('close', () => {
  firstAppear = true;
});
