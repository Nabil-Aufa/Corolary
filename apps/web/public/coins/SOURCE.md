# Coin logos

`eth.svg`, `wbtc.svg`, `usdc.svg`, `usdt.svg`, `dai.svg`, `aave.svg`, `link.svg`, `uni.svg`,
`mkr.svg`, `comp.svg`, `crv.svg`, `snx.svg` and `bal.svg` are copied unmodified from the
`svg/color/` set of **cryptocurrency-icons** v0.18.1
(https://github.com/spothq/cryptocurrency-icons), released under **CC0-1.0** (public
domain dedication). Brand colors used for the coin rims come from that package's
`manifest.json`.

`wsteth.svg`, `ldo.svg`, `frax.svg`, `gho.svg`, `reth.svg`, `pendle.svg`, `ens.svg`,
`rpl.svg`, `cbeth.svg` and `yfi.svg` come from `dist/svgs/tokens/branded/` of
**@web3icons/core** v4.0.55 (https://github.com/0xa3k5/web3icons), released under the
**MIT** license. That package ships them as JS modules wrapping the SVG source; the
markup is the module's string verbatim, with its escaped newlines turned back into
newlines. cryptocurrency-icons has none of these ten.

`cbbtc.svg` and `usds.svg` come from **@bgd-labs/react-web3-icons** v1.64.0
(https://github.com/bgd-labs/react-web3-icons), **MIT**, the only one of the three sets
that carries either. Both are monochrome silhouettes drawn with `currentColor`; an
`<img>` has no inherited colour to resolve that against, so `currentColor` is replaced
here with `#ffffff` and the rim carries the brand colour.

Two substitutions, agreed with the project owner rather than chosen here:

- **SKY** has no mark in any of the three sets. `sky.svg` does exist in
  cryptocurrency-icons v0.18.1, but that is Skycoin from 2021, not the MakerDAO rebrand,
  so using it would put the wrong mark on the coin. **USDS**, the Sky ecosystem's
  stablecoin, stands in for it.
- **MORPHO** has no mark in any of the three sets either (1,788 symbols checked in
  @web3icons alone). **YFI** stands in for it.

Three notes on rims, in `CONFIG.brandColors`:

- wstETH and LDO are the same Lido mark — wstETH has no icon of its own in either set —
  so they are told apart by rim alone: a light neutral (`#e6eefa`) against Lido's coral
  (`#f69988`).
- FRAX, GHO and PENDLE ship as a light mark on nothing, and cbBTC and USDS as white ones.
  Their rims are chosen here rather than taken from a manifest, dark enough that the mark
  still reads.
- cbETH's mark is a solid Coinbase blue, which would vanish on a Coinbase-blue rim, so
  that one gets a light rim instead and the pairing with cbBTC inverts: blue disc with a
  white mark against a light disc with a blue mark.

The logos are trademarks of their respective projects and are used here only to
identify the assets, as decoration in the landing hero.
