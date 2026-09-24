/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as buybackMetrics from "../buybackMetrics.js";
import type * as crons from "../crons.js";
import type * as heliusClient from "../heliusClient.js";
import type * as http from "../http.js";
import type * as news from "../news.js";
import type * as pythBuybackSnapshots from "../pythBuybackSnapshots.js";
import type * as pythGovernanceStakerCollection from "../pythGovernanceStakerCollection.js";
import type * as pythGovernanceStakers from "../pythGovernanceStakers.js";
import type * as pythHolderCollection from "../pythHolderCollection.js";
import type * as pythHolders from "../pythHolders.js";
import type * as pythPro from "../pythPro.js";
import type * as reserveSnapshots from "../reserveSnapshots.js";
import type * as trackerActions from "../trackerActions.js";
import type * as trackerModel from "../trackerModel.js";
import type * as trackerQueries from "../trackerQueries.js";
import type * as trackerStore from "../trackerStore.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  buybackMetrics: typeof buybackMetrics;
  crons: typeof crons;
  heliusClient: typeof heliusClient;
  http: typeof http;
  news: typeof news;
  pythBuybackSnapshots: typeof pythBuybackSnapshots;
  pythGovernanceStakerCollection: typeof pythGovernanceStakerCollection;
  pythGovernanceStakers: typeof pythGovernanceStakers;
  pythHolderCollection: typeof pythHolderCollection;
  pythHolders: typeof pythHolders;
  pythPro: typeof pythPro;
  reserveSnapshots: typeof reserveSnapshots;
  trackerActions: typeof trackerActions;
  trackerModel: typeof trackerModel;
  trackerQueries: typeof trackerQueries;
  trackerStore: typeof trackerStore;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
