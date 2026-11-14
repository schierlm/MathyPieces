/*
 * Copyright 2026 Michael Schierl <schierlm@gmx.de>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { ContinuedFraction, ContinuedFractionBuilder } from "./types.js";

export type GuessableNumberFactory<GN> = {
    int: (n: bigint) => GN,
    sign: (x: GN) => number,
    pi: () => GN,
    exp: (x: GN) => GN,
    ln: (x: GN) => GN,
    mul: (x: GN, y: GN) => GN,
    div: (x: GN, y: GN) => GN,
    cfrac: (n: GN) => ContinuedFractionBuilder,
};

export enum NumberFormKind { NO_MATCH, BASIC, RADICAL, PI, EXP, LOG }
export type NumberForm = {
    name: string,
    kind: NumberFormKind,
    baseOrExponentOrDegree: bigint,
};

export type Guess = {
    form: NumberForm,
    cfrac: ContinuedFraction,
    numerator: bigint,
    denominator: bigint, // positive
    factor: bigint,
    radicand: bigint, // positive and square-free
}

export const NUMBER_FORMS: NumberForm[] = [
    { name: "x", kind: NumberFormKind.BASIC, baseOrExponentOrDegree: 0n },
    { name: "√x", kind: NumberFormKind.RADICAL, baseOrExponentOrDegree: 2n },
    { name: "∛x", kind: NumberFormKind.RADICAL, baseOrExponentOrDegree: 3n },
    { name: "xπ", kind: NumberFormKind.PI, baseOrExponentOrDegree: 1n },
    { name: "xπ²", kind: NumberFormKind.PI, baseOrExponentOrDegree: 2n },
    { name: "x/π", kind: NumberFormKind.PI, baseOrExponentOrDegree: -1n },
    { name: "x/π²", kind: NumberFormKind.PI, baseOrExponentOrDegree: -2n },
    { name: "e^x", kind: NumberFormKind.EXP, baseOrExponentOrDegree: 0n },
    { name: "2^x", kind: NumberFormKind.EXP, baseOrExponentOrDegree: 2n },
    { name: "10^x", kind: NumberFormKind.EXP, baseOrExponentOrDegree: 10n },
    { name: "ln x", kind: NumberFormKind.LOG, baseOrExponentOrDegree: 0n },
    { name: "log_2 x", kind: NumberFormKind.LOG, baseOrExponentOrDegree: 2n },
    { name: "log_10 x", kind: NumberFormKind.LOG, baseOrExponentOrDegree: 10n },
];

const NO_MATCH_NUMBER_FORM: NumberForm = { name: "?", kind: NumberFormKind.NO_MATCH, baseOrExponentOrDegree: 0n };

class UnsolvableContinuedFractionBuilder extends ContinuedFractionBuilder {
    step(): boolean {
        return false;
    }
    get(): ContinuedFraction {
        return {
            complete: false,
            negative: false,
            prefix: [],
            period: []
        }
    }
}

const unsolvableBuilder : ContinuedFractionBuilder = new UnsolvableContinuedFractionBuilder;

export function prepareForms<GN>(n: GN, factory: GuessableNumberFactory<GN>): ContinuedFractionBuilder[] {
    let pi: GN = factory.pi();
    let nSquared: GN = factory.mul(n, n);
    let nCubed: GN = factory.mul(nSquared, n);
    let nPi: GN = factory.mul(n, pi);
    let nPi2: GN = factory.mul(nPi, pi);
    let nDivPi: GN = factory.div(n, pi);
    let nDivPi2: GN = factory.div(nDivPi, pi);
    let ln2: GN = factory.ln(factory.int(2n));
    let ln10: GN = factory.ln(factory.int(10n));
    let logTerms: ContinuedFractionBuilder[] = [];
    if (factory.sign(n) > 0) {
        let nLn: GN = factory.ln(n);
        let nLog2: GN = factory.div(nLn, ln2);
        let nLog10: GN = factory.div(nLn, ln10);
        logTerms = [
            factory.cfrac(nLn), // e^x
            factory.cfrac(nLog2), // 2^x
            factory.cfrac(nLog10) // 10^x
        ];
    } else {
        logTerms = [
            unsolvableBuilder, // e^x
            unsolvableBuilder, // 2^x
            unsolvableBuilder, // 10^x
        ]
    }
    let eToN: GN = factory.exp(n);
    let d2ToN: GN = factory.exp(factory.mul(n, ln2));
    let d10ToN: GN = factory.exp(factory.mul(n, ln10));

    return [
        factory.cfrac(n), // x
        factory.cfrac(nSquared), // √x
        factory.cfrac(nCubed), // ∛x
        factory.cfrac(nDivPi), // xπ
        factory.cfrac(nDivPi2), // xπ²
        factory.cfrac(nPi), // x/π
        factory.cfrac(nPi2), // x/π²
        ...logTerms,
        factory.cfrac(eToN), // ln x
        factory.cfrac(d2ToN), // log_2 x
        factory.cfrac(d10ToN), // log_10 x
    ];
}

function gcd(a: bigint, b: bigint) {
    if (a < 0n) a = -a;
    if (b < 0n) b = -b;
    while (b !== 0n) {
        [a, b] = [b, a % b]
    }
    return a;
}

export function simpleToGuess(form: NumberForm, prefix: bigint[], negative: boolean): Guess {
    let numerator: bigint = prefix[prefix.length - 1];
    let denominator: bigint = 1n;
    for (let i = prefix.length - 2; i >= 0; i--) {
        [numerator, denominator] = [denominator + numerator * prefix[i], numerator];
    }
    let f = gcd(numerator, denominator);
    numerator /= f;
    denominator /= f;
    if (negative) {
        numerator = -numerator;
    }
    return {
        form,
        cfrac: {
            complete: true,
            negative: negative,
            prefix: prefix,
            period: []
        },
        numerator: numerator,
        denominator: denominator,
        factor: 0n,
        radicand: 1n
    };
}
export function cfracToGuess(form: NumberForm, cfrac: ContinuedFraction): Guess {
    if (cfrac.complete && cfrac.period.length == 0) {
        return simpleToGuess(form, cfrac.prefix, cfrac.negative);
    }
    let nu: bigint = 0n, nx: bigint = 1n, du: bigint = 1n, dx: bigint = 0n;
    for (let i = cfrac.period.length - 1; i >= 0; i--) {
        let w: bigint = cfrac.period[i];
        [nu, nx, du, dx] = [du + nu * w, dx + nx * w, nu, nx];
    }
    // solve: x = (nu + nx * x) / (du + dx * x)
    // => dx x² + (du -nx) x - nu = 0
    let a: bigint = dx, b: bigint = du - nx, c: bigint = -nu;
    if (a < 0) {
        [a, b, c] = [-a, -b, -c];
    }
    let num: bigint = -b, den: bigint = 2n * a, fct: bigint = 1n, rdc: bigint = b * b - 4n * a * c;
    if (rdc < 0n) {
        throw new Error("Assertion failed: quadratic equation has no real solution");
    }
    for (let candidate: bigint = 2n, square: bigint = 4n; square <= rdc; candidate++, square = candidate * candidate) {
        while (rdc % square == 0n) {
            rdc /= square;
            fct *= candidate;
        }
    }
    for (let i = cfrac.prefix.length - 1; i >= 0; i--) {
        let w: bigint = cfrac.prefix[i];
        [num, fct, den] = [den * num + num * num * w - fct * fct * rdc * w, -den * fct, num * num - fct * fct * rdc];
    }
    if (cfrac.negative) {
        den = -den;
    }
    if (den < 0) {
        [num, fct, den] = [-num, -fct, -den];
    }
    let g = gcd(fct, gcd(num, den));
    num /= g;
    den /= g;
    fct /= g;
    return {
        form,
        cfrac,
        numerator: num,
        denominator: den,
        factor: fct,
        radicand: rdc
    };
}

export function stepForms(forms: ContinuedFractionBuilder[], maxSteps: number): Guess {
    for (let i = 0; i < 5; i++) {
        if (forms[0].step()) {
            return cfracToGuess(NUMBER_FORMS[0], forms[0].get());
        }
    }
    for (let i = 0; i < maxSteps; i++) {
        if (forms[0].step()) {
            return cfracToGuess(NUMBER_FORMS[0], forms[0].get());
        }
        for (let j = 0; j < NUMBER_FORMS.length; j++) {
            if (forms[j].step()) {
                return cfracToGuess(NUMBER_FORMS[j], forms[j].get());
            }
        }
    }
    return {
        form: NO_MATCH_NUMBER_FORM,
        cfrac: forms[0].get(),
        numerator: 0n,
        denominator: 1n,
        factor: 0n,
        radicand: 1n
    };
}

export function doGuess<GN>(number: GN, factory: GuessableNumberFactory<GN>, maxSteps: number): Guess {
    let forms: ContinuedFractionBuilder[] = prepareForms(number, factory);
    return stepForms(forms, maxSteps);
}

function validateGuess(guess: Guess) {
    if (guess.denominator < 1n) {
        throw new Error("Denominator must be positive");
    }
    if (guess.factor != 0n && guess.radicand < 1n) {
        throw new Error("Radicand must be positive");
    }
}

export function prettyPrintGuess(guess: Guess): string {
    validateGuess(guess);
    let result: string = "" + guess.numerator;
    if (guess.factor != 0n) {
        if (guess.numerator == 0n) {
            result = "";
        } else {
            result += (guess.factor > 0 ? "+" : "");
        }
        result += (guess.factor == 1n ? "" : guess.factor == -1n ? "-" : "" + guess.factor) + "√" + guess.radicand;
        if (guess.denominator != 1n) {
            result = "(" + result + ")";
        }
    }
    if (guess.denominator != 1n) {
        result = result + "/" + guess.denominator;
    }
    if (guess.form.kind != NumberFormKind.BASIC) {
        result = guess.form.name.replaceAll("x", "(" + result + ")");
    }
    return result;
}

function numAndSignMathML(number: bigint, plus: boolean): MathMLElement {
    let mrow: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mrow");
    let mn: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
    if (number < 0) {
        let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
        mo.innerHTML = "-";
        mrow.appendChild(mo);
        mn.innerHTML = "" + (-number);
    } else {
        if (plus) {
            let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = "+";
            mrow.appendChild(mo);
        }
        mn.innerHTML = "" + number;
    }
    mrow.appendChild(mn);
    return mrow;
}

export function prettyPrintGuessMathML(guess: Guess): MathMLElement {
    validateGuess(guess);
    let fraction: MathMLElement = numAndSignMathML(guess.numerator, false);
    let parensNeeded: boolean = false;
    if (guess.factor != 0n) {
        if (guess.numerator == 0n) {
            fraction = numAndSignMathML(guess.factor, false);
        } else {
            parensNeeded = true;
            let mrow = numAndSignMathML(guess.factor, true);
            fraction.appendChild(mrow.firstElementChild!);
            fraction.appendChild(mrow.lastElementChild!);
        }
        if (guess.factor == 1n || guess.factor == -1n) {
            fraction.removeChild(fraction.lastChild!);
        }
        let mn = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
        mn.innerHTML = "" + guess.radicand;
        let msqrt = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msqrt");
        msqrt.appendChild(mn);
        fraction.appendChild(msqrt);
    }
    if (guess.denominator != 1n) {
        parensNeeded = false;
        let num = fraction;
        fraction = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mfrac");
        fraction.appendChild(num);
        let mn = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
        mn.innerHTML = "" + guess.denominator;
        fraction.appendChild(mn);
    }
    let result: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
    result.setAttribute("display", "block");
    if (guess.form.kind == NumberFormKind.BASIC) {
        result.appendChild(fraction);
    } else if (guess.form.kind == NumberFormKind.RADICAL && guess.form.baseOrExponentOrDegree == 2n) {
        let sqrt: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msqrt");
        sqrt.appendChild(fraction);
        result.appendChild(sqrt);
    } else if (guess.form.kind == NumberFormKind.RADICAL && guess.form.baseOrExponentOrDegree == 3n) {
        let root: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mroot");
        root.appendChild(fraction);
        let mn = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
        mn.innerHTML = "3";
        root.appendChild(mn);
        result.appendChild(root);
    } else if (guess.form.kind == NumberFormKind.PI) {
        if (parensNeeded) {
            let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = "(";
            result.appendChild(mo)
            result.appendChild(fraction);
            mo = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = ")";
            result.appendChild(mo)
        } else {
            result.appendChild(fraction);
        }
        let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
        mo.innerHTML = "·";
        result.appendChild(mo);
        let pip = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
        pip.innerHTML = "π";
        if (guess.form.baseOrExponentOrDegree == 2n || guess.form.baseOrExponentOrDegree == -2n) {
            let msup = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msup");
            msup.appendChild(pip);
            let mn = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            mn.innerHTML = "2";
            msup.appendChild(mn);
            pip = msup;
        }
        if (guess.form.baseOrExponentOrDegree < 0n) {
            let mfrac = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mfrac");
            let mn = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            mn.innerHTML = "1";
            mfrac.appendChild(mn);
            mfrac.appendChild(pip);
            pip = mfrac;
        }
        result.appendChild(pip);
    } else if (guess.form.kind == NumberFormKind.EXP) {
        let base = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
        base.innerHTML = "" + guess.form.baseOrExponentOrDegree;
        if (guess.form.baseOrExponentOrDegree == 0n) { // e
            base = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
            base.innerHTML = "e";
        }
        let msup = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msup");
        msup.appendChild(base);
        msup.appendChild(fraction);
        result.appendChild(msup);
    } else if (guess.form.kind == NumberFormKind.LOG) {
        if (guess.form.baseOrExponentOrDegree == 0n) {
            let ln = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
            ln.innerHTML = "ln";
            result.append(ln);
        } else {
            let base = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            base.innerHTML = "" + guess.form.baseOrExponentOrDegree;
            let log = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mi");
            log.innerHTML = "log";
            let msub = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msub");
            msub.appendChild(log);
            msub.appendChild(base);
            result.appendChild(msub);
        }
        if (parensNeeded) {
            let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = "(";
            result.appendChild(mo)
            result.appendChild(fraction);
            mo = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = ")";
            result.appendChild(mo)
        } else {
            result.appendChild(fraction);
        }
    } else {
        throw new Error("Unsupported form");
    }
    return result;
}

export type PrimeFactor = bigint | [bigint, bigint];

export function primeFactorization(number: bigint): PrimeFactor[] {
    if (number == 0n) {
        return [0n];
    }
    if (number == 1n) {
        return [1n];
    }
    let result: PrimeFactor[] = [];
    if (number < 0) {
        number = -number;
        result.push(-1n);
    }
    for (let candidate: bigint = 2n; candidate * candidate <= number; candidate++) {
        let count: bigint = 0n;
        while (number % candidate == 0n) {
            count++;
            number /= candidate;
        }
        if (count == 1n) {
            result.push(candidate);
        } else if (count > 1n) {
            result.push([candidate, count]);
        }
    }
    if (number != 1n) {
        result.push(number);
    }
    return result;
}

export function prettyPrintFactorization(facts: PrimeFactor[]): string {
    let result: string = "";
    let added: boolean = false;
    for (let f of facts) {
        if (added) {
            result += "·";
        } else if (f == -1n) {
            result += "-";
            continue;
        }
        result += Array.isArray(f) ? f.join("^") : f;
        added = true;
    }
    return result;
}

export function prettyPrintFactorizationMathML(facts: PrimeFactor[]): MathMLElement {
    let result: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "math");
    result.setAttribute("display", "block");
    let added: boolean = false;
    for (let f of facts) {
        if (added) {
            let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = "·";
            result.appendChild(mo);
        } else if (f == -1n) {
            let mo: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mo");
            mo.innerHTML = "-";
            result.appendChild(mo);
            if (facts.length == 1) {
                let mn: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
                mn.innerHTML = "1";
                result.appendChild(mn);
            }
            continue;
        }
        if (Array.isArray(f)) {
            let msup: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "msup");
            let mn1: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            let mn2: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            mn1.innerHTML = "" + f[0];
            mn2.innerHTML = "" + f[1];
            msup.appendChild(mn1);
            msup.appendChild(mn2);
            result.appendChild(msup);
        } else {
            let mn: MathMLElement = document.createElementNS("http://www.w3.org/1998/Math/MathML", "mn");
            mn.innerHTML = "" + f;
            result.appendChild(mn);
        }
        added = true;
    }
    return result;
}
