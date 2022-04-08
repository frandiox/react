/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import {useState} from 'react';

declare var globalThis: any;

type ClientProxy = {
  id: string,
  name: string,
  isDefault: boolean,
  value: any,
};

// Store of components discovered during RSC to load
// them later when consuming the response in SSR.
globalThis.__COMPONENT_INDEX = {};

// Store to get module references for every export
// when rendering in RSC.
globalThis.__MODULE_REFERENCE_MAP = new Map();

export const MODULE_TAG = Symbol.for('react.module.reference');
export const STRING_SIZE_LIMIT = 64;
export const FN_RSC_ERROR =
  'Functions exported from client components cannot be called or used as constructors from a server component.';

// TODO what's a better way to detect Flight runtime?
export function isRsc() {
  try {
    useState();
    return false;
  } catch (error) {
    return error.message.endsWith('Server Components.');
  }
}

function createModuleReference(id, value, name, isDefault) {
  const moduleRef = Object.create(null);
  moduleRef.$$typeof = MODULE_TAG;
  moduleRef.filepath = id;
  moduleRef.name = isDefault ? 'default' : name;

  // Store component in a global index during RSC to use it later in SSR
  globalThis.__COMPONENT_INDEX[id] = Object.defineProperty(
    globalThis.__COMPONENT_INDEX[id] || Object.create(null),
    moduleRef.name,
    {value, writable: true},
  );

  return moduleRef;
}

// A ClientProxy behaves as a module reference for the Flight
// runtime (RSC) and as a real component for the Fizz runtime (SSR).
// Note that this is not used in browser environments.
export function wrapInClientProxy({id, name, isDefault, value}: ClientProxy) {
  const type = typeof value;

  if (
    value === null ||
    (type !== 'object' &&
      type !== 'function' &&
      (type !== 'string' || value.length < STRING_SIZE_LIMIT))
  ) {
    return value;
  }

  const moduleRef = createModuleReference(id, value, name, isDefault);
  globalThis.__MODULE_REFERENCE_MAP.set(value, moduleRef);

  return value;
}
