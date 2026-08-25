// DIHASILKAN OTOMATIS oleh packages/contracts/scripts/export-abi.mjs
// Jangan diedit manual — jalankan `pnpm contracts:abi`.

import FactRegistry from './FactRegistry.json' with { type: 'json' };
import CreditGraph from './CreditGraph.json' with { type: 'json' };
import PriceRegistry from './PriceRegistry.json' with { type: 'json' };
import EfficiencyMarket from './EfficiencyMarket.json' with { type: 'json' };
import AaveV3Adapter from './AaveV3Adapter.json' with { type: 'json' };
import SparkAdapter from './SparkAdapter.json' with { type: 'json' };
import MorphoBlueAdapter from './MorphoBlueAdapter.json' with { type: 'json' };
import CompoundV3Adapter from './CompoundV3Adapter.json' with { type: 'json' };
import FaucetToken from './FaucetToken.json' with { type: 'json' };

export const FactRegistryAbi = FactRegistry as const;
export const CreditGraphAbi = CreditGraph as const;
export const PriceRegistryAbi = PriceRegistry as const;
export const EfficiencyMarketAbi = EfficiencyMarket as const;
export const AaveV3AdapterAbi = AaveV3Adapter as const;
export const SparkAdapterAbi = SparkAdapter as const;
export const MorphoBlueAdapterAbi = MorphoBlueAdapter as const;
export const CompoundV3AdapterAbi = CompoundV3Adapter as const;
export const FaucetTokenAbi = FaucetToken as const;
