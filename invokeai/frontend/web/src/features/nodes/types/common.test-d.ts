import type {
  BaseModel,
  BoardField,
  Classification,
  CLIPField,
  ColorField,
  ControlField,
  ControlNetModelField,
  ImageField,
  ImageOutput,
  IPAdapterField,
  IPAdapterModelField,
  LoraInfo,
  LoRAModelField,
  MainModelField,
  ModelInfo,
  ModelType,
  ProgressImage,
  SchedulerField,
  SDXLRefinerModelField,
  SubModelType,
  T2IAdapterField,
  T2IAdapterModelField,
  UNetField,
  VAEField,
} from 'features/nodes/types/common';
import type { S } from 'services/api/types';
import type { Equals, Extends } from 'tsafe';
import { assert } from 'tsafe';
import { describe, test } from 'vitest';

/**
 * These types originate from the server and are recreated as zod schemas manually, for use at runtime.
 * The tests ensure that the types are correctly recreated.
 */

describe('Common types', () => {
  // Complex field types
  test('ImageField', () => assert<Equals<ImageField, S['ImageField']>>());
  test('BoardField', () => assert<Equals<BoardField, S['BoardField']>>());
  test('ColorField', () => assert<Equals<ColorField, S['ColorField']>>());
  test('SchedulerField', () => assert<Equals<SchedulerField, NonNullable<S['SchedulerInvocation']['scheduler']>>>());
  test('UNetField', () => assert<Extends<S['UNetField'], UNetField>>());
  test('CLIPField', () => assert<Extends<S['ClipField'], CLIPField>>());
  test('MainModelField', () => assert<Equals<MainModelField, S['MainModelField']>>());
  test('SDXLRefinerModelField', () => assert<Equals<SDXLRefinerModelField, S['MainModelField']>>());
  test('VAEField', () => assert<Extends<S['VaeField'], VAEField>>());
  test('ControlField', () => assert<Equals<ControlField, S['ControlField']>>());
  // @ts-expect-error TODO(psyche): fix types
  test('IPAdapterField', () => assert<Extends<IPAdapterField, S['IPAdapterField']>>());
  test('T2IAdapterField', () => assert<Equals<T2IAdapterField, S['T2IAdapterField']>>());
  test('LoRAModelField', () => assert<Equals<LoRAModelField, S['LoRAModelField']>>());
  test('ControlNetModelField', () => assert<Equals<ControlNetModelField, S['ControlNetModelField']>>());
  test('IPAdapterModelField', () => assert<Equals<IPAdapterModelField, S['IPAdapterModelField']>>());
  test('T2IAdapterModelField', () => assert<Equals<T2IAdapterModelField, S['T2IAdapterModelField']>>());

  // Model component types
  test('BaseModel', () => assert<Equals<BaseModel, S['BaseModelType']>>());
  test('ModelType', () => assert<Equals<ModelType, S['ModelType']>>());
  test('SubModelType', () => assert<Equals<SubModelType, S['SubModelType']>>());
  test('ModelInfo', () => assert<Equals<ModelInfo, S['ModelInfo']>>());

  // Misc types
  test('LoraInfo', () => assert<Extends<S['LoraInfo'], LoraInfo>>());
  test('ProgressImage', () => assert<Equals<ProgressImage, S['InvocationDenoiseProgressEvent']['progress_image']>>());
  test('ImageOutput', () => assert<Equals<ImageOutput, S['ImageOutput']>>());
  test('Classification', () => assert<Equals<Classification, S['Classification']>>());
});
