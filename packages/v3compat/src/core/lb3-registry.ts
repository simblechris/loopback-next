// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/v3compat
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {Application} from '@loopback/core';
import * as assert from 'assert';
import * as debugFactory from 'debug';
import {ModelBuilder} from 'loopback-datasource-juggler';
import {ModelClass, setupModelClass} from './lb3-model';
import {setupPersistedModelClass} from './lb3-persisted-model';
import {
  DataSource,
  DataSourceConfig,
  ModelConfig,
  ModelDefinition,
  ModelProperties,
  ModelSettings,
} from './lb3-types';

const debug = debugFactory('loopback:v3compat:mixin');

export class Lb3Registry {
  public modelBuilder: ModelBuilder = new ModelBuilder();

  constructor(protected lb4app: Application) {
    const ModelCtor = setupModelClass(this);
    setupPersistedModelClass(this);

    // Set the default model base class used by loopback-datasource-juggler.
    // TODO: fix juggler typings and define defaultModelBaseClass property
    // tslint:disable-next-line:no-any
    (this.modelBuilder as any).defaultModelBaseClass = ModelCtor;
  }

  createModel<T = ModelClass>(
    name: string,
    properties?: ModelProperties,
    settings?: ModelSettings,
  ): T;

  createModel<T = ModelClass>(definition: ModelDefinition): T;

  createModel<T = ModelClass>(
    nameOrDefinition: string | ModelDefinition,
    properties: ModelProperties = {},
    settings: ModelSettings = {},
  ): T {
    let name: string;
    if (typeof nameOrDefinition === 'string') {
      name = nameOrDefinition;
    } else {
      const config = nameOrDefinition;
      name = config.name;
      properties = config.properties;
      settings = buildModelOptionsFromConfig(config);

      assert(
        typeof name === 'string',
        'The model-config property `name` must be a string',
      );
    }

    debug('Creating a new model %s with properties %j', name, properties);

    if (!(settings.base || settings.super)) {
      settings.base = 'PersistedModel';
    }

    // TODO: use the code from LB3's lib/registry.ts
    const modelCtor = this.modelBuilder.define(
      name,
      properties,
      settings,
    ) as unknown;

    return modelCtor as T;
  }

  createDataSource(name: string, config: DataSourceConfig): DataSource {
    // TODO: use the code from LB3's lib/registry.ts
    // (we need to override ds.createModel method)
    return new DataSource(name, config, this.modelBuilder);
  }

  configureModel(modelCtor: ModelClass, config: ModelConfig) {
    // TODO: use the code from LB3's lib/registry.ts
    if (config.dataSource) {
      if (config.dataSource instanceof DataSource) {
        modelCtor.attachTo(config.dataSource);
      } else {
        assert.fail(
          `${
            modelCtor.modelName
          } is referencing a dataSource that does not exist: "${
            config.dataSource
          }"`,
        );
      }
    }
  }

  findModel(modelName: string | ModelClass): ModelClass | undefined {
    if (typeof modelName === 'function') return modelName;
    return this.modelBuilder.models[modelName] as ModelClass;
  }

  getModel(modelName: string | ModelClass): ModelClass {
    const model = this.findModel(modelName);
    if (model) return model;
    throw new Error(`Model not found: ${modelName}`);
  }
}

function buildModelOptionsFromConfig(config: ModelSettings) {
  const options = Object.assign({}, config.options);
  for (const key in config) {
    if (['name', 'properties', 'options'].indexOf(key) !== -1) {
      // Skip items which have special meaning
      continue;
    }

    if (options[key] !== undefined) {
      // When both `config.key` and `config.options.key` are set,
      // use the latter one
      continue;
    }

    options[key] = config[key];
  }
  return options;
}
