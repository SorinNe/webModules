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

import { checkError } from './system.js';

let keysValues;

const getJSONFile = (file = '') => fetch(file)
  .then(checkError)
  .then((res) => res.json());

export const applyLanguage = () => {
  for (const key in keysValues) {
    if (key in keysValues) {
      const elt = document.getElementById(key);
      if (elt) {
        if (elt.tagName.toLowerCase() === 'input') {
          if (elt.type === 'submit') {
            elt.value = keysValues[key];
          } else {
            elt.placeholder = keysValues[key];
          }
        } else {
          elt.innerText = keysValues[key];
        }
      }
    }
  }
};

export const init = async () => {
  try {
    const list = await getJSONFile('/i18n/list.json');
    if (navigator.languages[0] !== list.default) {
      for (const l of navigator.languages) {
        const file = list.languages[l.toLowerCase()];
        if (file) {
          try {
            keysValues = await getJSONFile(`/i18n/${file}`);
            applyLanguage();
            break;
          } catch (e) {
            console.error(e);
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
  }
};

export const getTranslate = (key) => (keysValues ? keysValues[key] : '');
