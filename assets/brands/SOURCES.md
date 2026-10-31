# Catalog brand logo sources

Retrieved: 2026-10-29

| Brand | Local asset | Download source |
| --- | --- | --- |
| Ferrari | ferrari.png | https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/ferrari.png |
| Lamborghini | lamborghini.png | https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized/lamborghini.png |

Source collection: https://github.com/filippofilip95/car-logos-dataset
The collection identifies Carlogos.org as the original image source.
Brand logos and trademarks remain the property of their respective owners.
These assets identify the vehicle manufacturers within the catalog.

## NETA

- Local asset: `neta.png` (720 × 200, transparent white horizontal logo)
- Source page: https://www.neta.my/
- Source image: https://glenmarie.neta.my/wp-content/uploads/2025/02/Logo-White-Horizontal.png
- Retrieved: 2026-10-30
- SHA-256: `8376400a431bffdfeb0ba2ed85721a17fd1f5a7bc8db42dc8f7190d403a6de5c`

Original image preserved without recoloring. This is a brand identification
asset from a NETA dealer website, not part of the MIT repository below.
The logo and trademark remain the property of NETA/their respective owners.
The existing adaptive backdrop supplies contrast for the white mark.

## Supplemental logos

Nine previously missing brand logos (AION, AVATR, DEEPAL, Denza, JAECOO,
KGM, ORA, Xiaomi, Yangwang) are stored in `supplemental/` from
https://github.com/vehiclespecs/brand-logos at commit
`3f0929e70e0a9a2a502063edc4b3e5c0146cba74`.

`supplemental/manifest.json` records exact source URLs and SHA-256 checksums.
The upstream README and LICENSE are preserved alongside the images. Upstream
MIT covers organization and metadata; the logo images remain the trademarks
of their respective owners, provided for identification and reference.

Re-import with `node scripts/fetch-supplemental-logos.mjs`. SVGs are checked
for active or linked content before being saved. These local assets supplement
the brand directory at render time, including existing cached brand records;
no database seed or API cache invalidation is required.

Fangchengbao, HYPTEC and TANK still have no verified matching asset in this
import. Keep the generic car icon instead of substituting a parent-brand logo.
