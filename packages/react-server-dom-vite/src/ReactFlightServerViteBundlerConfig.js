/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

declare var globalThis: any;

export type BundlerConfig = {};

// eslint-disable-next-line no-unused-vars
export type ModuleReference<T> = {
  $$typeof: Symbol,
  filepath: string,
  name: string,
};

export type ModuleMetaData = {
  id: string,
  name: string,
};

export type ModuleKey = string;

export function getModuleKey(reference: ModuleReference<any>): ModuleKey {
  return reference.filepath + '#' + reference.name;
}

export function getModuleReference(reference: any): ?Object {
  return globalThis.__MODULE_REFERENCE_MAP.get(reference);
}

export function resolveModuleMetaData<T>(
  config: BundlerConfig,
  moduleReference: ModuleReference<T>,
): ModuleMetaData {
  return {
    id: moduleReference.filepath,
    name: moduleReference.name,
  };
}
