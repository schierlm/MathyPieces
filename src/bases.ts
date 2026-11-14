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

import { UnifiedReal, ArithmeticException, BoundedRational } from "crcalc-js";

export type ArbitraryBasesOptions = {
    showEllipsis: boolean,
    detectPeriod: boolean,
    maxDigits: number,
    compareDigits: number
};

export function toArbitraryBase(value: UnifiedReal, base: UnifiedReal, opts: ArbitraryBasesOptions): string {
    if (base.compareToA(UnifiedReal.ONE, -opts.compareDigits) != 1) {
        return "Base must be larger than 1";
    }
    if (base.compareToA(UnifiedReal.newN(36n), -opts.compareDigits) == 1) {
        return "Base must be at most 36";
    }
    let result: string = "";
    if (value.signumA(opts.compareDigits) == -1) {
        value = value.negate();
        result += "-";
    }
    let preDivides = 0;
    while (value.signumA(-opts.compareDigits) == -1 || value.compareToA(base, -opts.compareDigits) != -1) {
        preDivides++;
        value = value.divide(base);
    }
    let remainders = [];
    while (preDivides >= 0 || (preDivides >= -opts.maxDigits && !value.definitelyZero())) {
        if (preDivides < 0 && opts.detectPeriod) {
            remainders.push(value);
        }
        if (preDivides == -1) {
            result += ".";
        }
        preDivides--;
        let whole: bigint = BigInt(value.toStringTruncated(0).replace(/\.$/, ""));
        let lastValue = value;
        value = value.subtract(UnifiedReal.newN(whole)).multiply(base);
        if (value.signumA(-opts.compareDigits) == -1) {
            whole--;
            value = lastValue.subtract(UnifiedReal.newN(whole)).multiply(base);
        }
        result += whole.toString(36).toUpperCase();
        if (opts.detectPeriod) {
            for (let i = 0; i < remainders.length; i++) {
                if (value.compareToA(remainders[i], -opts.compareDigits) == 0) {
                    let cutoffPos = result.length - remainders.length + i;
                    result = result.substring(0, cutoffPos) + "_" + result.substring(cutoffPos);
                    value = UnifiedReal.ZERO;
                }
            }
        }
    }
    if (!value.definitelyZero() && opts.showEllipsis) {
        result += "...";
    }
    return result;
}
