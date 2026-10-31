# Third-party notices

## React Bits — Magnet

The Angular component in src/app/shared/react-bits/magnet/magnet.ts adapts the
center-distance attraction and damped spring approach from React Bits Magnet.
It is a limited Angular port, not the React runtime component. It adds an 8px
movement cap, touch/reduced-motion handling and Angular lifecycle cleanup.

Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/Animations/Magnet/Magnet.jsx
License: https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md
Retrieved: 2026-10-28

MIT + Commons Clause License Condition v1.0

Copyright (c) 2026 David Haz

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, and distribute the Software **as part of an application, website, or product**, subject to the following conditions:
The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

## Commons Clause Restriction

You may use this Software, including for any commercial purpose, **so long as you do not sell, sublicense, or redistribute the components themselves-whether alone, in a bundle, or as a ported version.**
The same restriction covers the React Bits tools (Background Studio, Texture Lab, Shape Magic, Center Stage, Sound Lab and any tools added later) and the sounds in the sound library. **You may not sell, sublicense, or redistribute the tools or the sounds themselves, or offer the tools or a substantially similar copy of them as a hosted service-whether alone, in a bundle, or as a ported version.**
What you make with the tools is yours to use. You can use exported code, images, videos, and audio files in any personal or commercial application, website, or product, including paid ones. **You may not sell or redistribute the exports on their own, either individually or as the product itself, such as a sound, texture, background, or template pack.**

## No Warranty

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## React Bits — ShinyText (current UI)

The component in src/app/shared/react-bits/shiny-text/ is a simplified Angular
adaptation of ShinyText's clipped gradient sweep. Animation is implemented with
CSS keyframes instead of the React hooks and requestAnimationFrame engine.
Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/ShinyText/ShinyText.jsx
CSS: https://github.com/DavidHDev/react-bits/blob/main/src/content/TextAnimations/ShinyText/ShinyText.css
Copyright (c) 2026 David Haz. The license reproduced above applies.
The previously used Magnet component is no longer mounted in the UI.

## React Bits — SpecularButton

The renderer in src/app/shared/react-bits/specular-button/specular-button.engine.js
is adapted from the upstream SpecularButton source. The WebGL shaders, rim geometry,
pointer lighting and rendering lifecycle are retained, with a fixed preset and an
Angular lifecycle adapter in shared/ui/start-button. Button position and scale stay
fixed. Reduced motion disables pointer following; CSS provides a static glass rim
when WebGL is unavailable.

Source: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/SpecularButton/SpecularButton.jsx
CSS: https://github.com/DavidHDev/react-bits/blob/main/src/content/Components/SpecularButton/SpecularButton.css
Copyright (c) 2026 David Haz. The license reproduced above applies.
# Vehicle model reference database

The adapted model database is licensed under ODbL 1.0, separate from application code.
Attribution: [vehicle-makes-models](https://github.com/gor3a/vehicle-makes-models)
and [autoevolution.com](https://www.autoevolution.com/).
Changes include filtering to 28 brands, keeping model names only (removing engines,
generations, years and chassis information), and adding official model names.
The complete adapted snapshot is available from the model selector's download link
at `/api/catalog/models/export`. Original notice: Backend `data/models/raw/LICENSE-DATA`.
