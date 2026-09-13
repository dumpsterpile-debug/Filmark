import type { StateCreator } from "zustand";
import type { AppState } from "./types";

/**
 * 切片创建器的公共签名。
 *
 * `AppState` 是所有切片相加的结果，切片文件只依赖这个类型、不依赖组合根；
 * `["zustand/persist", unknown]` 是把切片装进 persist 中间件时必须显式声明的 mutator。
 */
export type SliceCreator<T> = StateCreator<AppState, [["zustand/persist", unknown]], [], T>;
