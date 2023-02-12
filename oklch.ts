// Includes code copied from Björn Ottosson
// under public domain
// https://bottosson.github.io/posts/oklab/

export interface LCH {
    lightness : number
    chroma    : number
    hue       : number
}

export interface RGB {
    red   : number
    green : number
    blue  : number
}

type Triplet = [ number, number, number ]

export default { fromRGB, toRGB }

export function fromRGB({ red, green, blue }: RGB): LCH {
    const [ lightness, chroma, hue ] = LAB_to_LCH(linear_sRGB_to_OKLAB(sRGB_to_linear_sRGB([red, green, blue])))
    return { lightness, chroma, hue }
}

/**
 * @param lightness luminance or brightness 
 * range: 0 to 1
 * 
 * @param chroma vividness or saturation 
 * range: at least 0, upwards limit depends on color space and hue and lightness
 * 
 * for sRGB, chroma of...
 * *                0.025 is safe at lightness of 0.15
 * *                0.042 is safe at lightness of 0.25
 * *                0.085 is safe at lightness of 0.50
 * *                0.127 is safe at lightness of 0.75
 * *                0.048 is safe at lightness of 0.90
 * 
 * for P3, chroma of...
 * *                0.034 is safe at lightness of 0.15
 * *                0.056 is safe at lightness of 0.25
 * *                0.113 is safe at lightness of 0.50
 * *                0.138 is safe at lightness of 0.75
 * *                0.052 is safe at lightness of 0.90
 * 
 * higher chroma would lead to non-displayable colors at some hues
 * 
 * which will be automatically replaced with less chromatic colors 
 * 
 * 
 * @param hue hue angle in degrees 
 * range: 0 to 360, repeating
 * 
*/
export function toRGB({ lightness, chroma, hue }: LCH, options : { gamutCorrectIfNeeded: true    }): RGB
export function toRGB({ lightness, chroma, hue }: LCH, options?: { gamutCorrectIfNeeded: boolean }): RGB | undefined
export function toRGB({ lightness, chroma, hue }: LCH, options?: { gamutCorrectIfNeeded: boolean }): RGB | undefined {
    assert(0 <= lightness && lightness <= 1, 'Lightness must be at least 0 and at most 1', { lightness })
    assert(0 <= chroma, 'Chroma must be at least 0', { chroma })
    if (options?.gamutCorrectIfNeeded) {
        const [ red, green, blue ] = OKLCH_to_RGB([lightness, chroma, hue], true)
        return { red, green, blue }
    }
    const rgb = OKLCH_to_RGB([lightness, chroma, hue], false)
    if (rgb === undefined) return undefined
    const [ red, green, blue ] = rgb
    return { red, green, blue }
}

function OKLCH_to_RGB (lch: Triplet, gamutCorrectIfNeeded: true,     needsGamutCorrection?: boolean, step?: number): Triplet
function OKLCH_to_RGB (lch: Triplet, gamutCorrectIfNeeded?: boolean, needsGamutCorrection?: boolean, step?: number): Triplet | undefined
function OKLCH_to_RGB (
    [lightness, chroma, hue]: Triplet,
    gamutCorrectIfNeeded = true,
    needsGamutCorrection = false,
    step = chroma / 2,
): Triplet | undefined {

    const rgb = linear_sRGB_to_sRGB(OKLAB_to_linear_sRGB(LCH_to_LAB([lightness, chroma, hue])))
    const inGamut = rgb.every( x => 0 <= x && x <= 1 )
    
         if (inGamut && needsGamutCorrection === false) return rgb
    else if (inGamut && step <= 0.0051) return rgb
    else if (inGamut)              return OKLCH_to_RGB([lightness, chroma + step, hue], gamutCorrectIfNeeded, needsGamutCorrection, step / 2)
    else if (gamutCorrectIfNeeded) return OKLCH_to_RGB([lightness, chroma - step, hue], gamutCorrectIfNeeded, needsGamutCorrection, step / 2)
    else return undefined
}

function LCH_to_LAB ([lightness, chroma, hue]: Triplet): Triplet {
    return [
        lightness,
        chroma * Math.cos(hue * Math.PI / 180),
        chroma * Math.sin(hue * Math.PI / 180)
    ]
}

function LAB_to_LCH ([lightness, a, b]: Triplet): Triplet {
    return [
        lightness,
        Math.sqrt(a * a + b * b),
        Math.atan2(b, a) * 180 / Math.PI
    ]
}

function OKLAB_to_linear_sRGB ([l, a, b]: Triplet): Triplet {
    const L = Math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3)
    const M = Math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3)
    const S = Math.pow(l - 0.0894841775 * a - 1.2914855480 * b, 3)

    return [
        +4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S,
        -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S,
        -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S
    ]
}

function linear_sRGB_to_OKLAB([r, g, b]: Triplet): Triplet {
    const L = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
	const M = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
	const S = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

    return [
        0.2104542553 * L + 0.7936177850 * M - 0.0040720468 * S,
        1.9779984951 * L - 2.4285922050 * M + 0.4505937099 * S,
        0.0259040371 * L + 0.7827717662 * M - 0.8086757660 * S,
    ]
}

function linear_sRGB_to_sRGB (lrgb: Triplet): Triplet {
    return lrgb.map(gammaConversion) as Triplet
}

function sRGB_to_linear_sRGB (srgb: Triplet): Triplet {
    return srgb.map(inverseGammaConversion) as Triplet
}

function gammaConversion (val: number) {
    const sign = val < 0 ? -1 : 1
    const abs = Math.abs(val)
    return (abs > 0.0031308)
            ? sign * (1.055 * Math.pow(abs, 1/2.4) - 0.055)
            : 12.92 * val
}

function inverseGammaConversion (val: number) {
    const sign = val < 0 ? -1 : 1
    const abs = Math.abs(val)
    return (abs > 0.04045)
            ? sign * Math.pow((abs + 0.055) / 1.055, 2.4)
            : abs / 12.92
}

function assert(assertion: boolean, msg = "Assertion failed", cause?: unknown): asserts assertion {
    if (assertion === true) return
    else throw new Error(msg, { cause })
}
