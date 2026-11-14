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
import { UnifiedReal, ArithmeticException, BoundedRational } from "crcalc-js";

export type ConstructedContinuedFractionOptions = {
    detectPeriod: boolean,
    termLengthForInfinity: number,
    compareDigits: number,
    maxSteps: number
};

export class ConstructedContinuedFractionBuilder extends ContinuedFractionBuilder {

    private current: UnifiedReal;
    private readonly opts: ConstructedContinuedFractionOptions;
    private intermediate: UnifiedReal[] = [];
    private result: ContinuedFraction = { complete: false, negative: false, prefix: [], period: [] };

    constructor(ur: UnifiedReal, opts: ConstructedContinuedFractionOptions) {
        super();
        this.current = ur;
        this.opts = opts;
        if (ur.signumA(-opts.compareDigits) == -1) {
            this.current = this.current.negate();
            this.result.negative = true;
        }
    }

    step(): boolean {
        if (this.result.complete)
            return true;
        let wholeString = this.current.toStringTruncated(0).replace(/\.$/, "");
        if (wholeString.length >= this.opts.termLengthForInfinity) {
            this.result.complete = true;
        } else {
            let whole: bigint = BigInt(wholeString);
            this.result.prefix.push(whole);
            try {
                this.current = this.current.subtract(UnifiedReal.newN(whole));
                if (this.current.signumA(-5 * this.opts.termLengthForInfinity) == 0) {
                    this.result.complete = true;
                }
                this.current = this.current.inverse();
            } catch (e: unknown) {
                if (e instanceof ArithmeticException) {
                    this.result.complete = true;
                } else {
                    throw e;
                }
            }
        }
        if (this.opts.detectPeriod && !this.result.complete) {
            for (let i = 0; i < this.intermediate.length; i++) {
                if (this.current.compareToA(this.intermediate[i], -this.opts.compareDigits) == 0) {
                    this.result.period.push(...this.result.prefix.splice(i + 1, this.intermediate.length - i));
                    this.result.complete = true;
                    break;
                }
            }
            this.intermediate.push(this.current);
        }
        return this.result.complete;
    }

    get(): ContinuedFraction {
        return this.result;
    }
}

export function toContinuedFraction(ur: UnifiedReal, opts?: ConstructedContinuedFractionOptions) {
    opts ||= { detectPeriod: true, maxSteps: 1024, termLengthForInfinity: 128, compareDigits: 64 };
    let b = new ConstructedContinuedFractionBuilder(ur, opts);
    for (let i = 0; i < opts.maxSteps; i++) {
        if (b.step())
            return b.get();
    }
    return b.get();
}

export function prettyPrintContinuedFractionHTML(cf: ContinuedFraction): HTMLElement {
    let element = document.createElement("span");
    element.innerText = (cf.negative ? "-" : "") + "[" + cf.prefix.join(", ");
    if (cf.period.length > 0) {
        element.innerText += ", ";
        let period = document.createElement("span");
        period.style.textDecoration = "overline";
        period.innerText = cf.period.join(", ");
        element.appendChild(period);
    }
    let suffix = document.createElement("span");
    suffix.innerText = (cf.complete ? "" : ", ...") + "]";
    if (suffix.firstChild == null)
        throw new Error("Text node disappeared?");
    element.appendChild(suffix.firstChild);
    return element;
}

export { ContinuedFraction };
