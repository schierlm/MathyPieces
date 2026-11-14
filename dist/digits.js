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
function testCandidate(absBase, cand, config) {
    let carry = cand;
    for (let i = 0; i < 100 && carry != 0n; i++) {
        let digit = (carry % absBase + absBase) % absBase;
        carry -= config.sortedValues[Number(digit)];
        carry /= absBase;
    }
    return carry == 0n;
}
export function createDigitConfiguration(base, digits) {
    if (base < -36n || base > 36n || base == -1n || base == 0n || base == 1n)
        return "Unsupported base";
    let absBase = base < 0 ? -base : base;
    let confDigits = [];
    let result = {
        base,
        sortedDigits: "",
        sortedValues: [],
        supportsNegative: base < 0
    };
    let biggestDigitValue = 0n;
    for (let dig in digits) {
        if (dig == '')
            return "Digits may not be empty";
        else if (dig.length > 1)
            return "Digit '" + dig + "' too long";
        let place = Number((digits[dig] % absBase + absBase) % absBase);
        if (result.sortedValues[place] != null)
            return "Two digit values have same remainder " + place;
        result.sortedValues[place] = digits[dig];
        confDigits[place] = dig;
        let absValue = digits[dig] < 0 ? -digits[dig] : digits[dig];
        if (absValue > biggestDigitValue)
            biggestDigitValue = absValue;
    }
    result.sortedDigits = confDigits.join("");
    if (result.sortedValues.length != Number(absBase) || confDigits.length != Number(absBase)
        || Object.keys(result.sortedValues).length != Number(absBase) || result.sortedDigits.length != Number(absBase)) {
        return "Not enough digits defined";
    }
    for (let cand = 0n; cand <= biggestDigitValue / (absBase - 1n); cand++) {
        if (!testCandidate(absBase, cand, result))
            throw new Error("Number " + cand + " cannot be represented");
    }
    if (base > 0) {
        let negTest = true;
        for (let cand = 1n; negTest && cand <= biggestDigitValue / (absBase - 1n); cand++) {
            if (!testCandidate(absBase, -cand, result))
                negTest = false;
        }
        result.supportsNegative = negTest;
    }
    return result;
}
export function convert(value, config) {
    let prefix = "", result = "";
    let negInput = false;
    let negOutput = [false, false];
    if (value.startsWith("-")) {
        if (config.supportsNegative) {
            negInput = true;
        }
        else {
            prefix = "-";
        }
        value = value.substring(1);
    }
    if (!/[0-9A-Z]+\.?[0-9A-Z]*/.test(value))
        throw new Error("Unsupported value: " + value);
    let decPos = value.indexOf(".");
    if (decPos != -1) {
        value = value.substring(0, decPos) + value.substring(decPos + 1);
    }
    else {
        decPos = value.length;
    }
    if (config.base < 0) {
        negOutput[decPos % 2] = true;
    }
    let carry = 0n;
    let absBase = config.base < 0 ? -config.base : config.base;
    for (let i = value.length - 1; carry != 0n || i >= 0; i--) {
        if (i + 1 == decPos) {
            result = "." + result;
        }
        if (i >= 0) {
            carry += BigInt(parseInt(value.charAt(i), 36) * (negInput ? -1 : 1));
        }
        let digit = (carry % absBase + absBase) % absBase, factor = 1n;
        if (negOutput[(i % 2 + 2) % 2]) {
            digit = (absBase - digit) % absBase;
            factor = -1n;
        }
        result = config.sortedDigits[Number(digit)] + result;
        carry -= config.sortedValues[Number(digit)] * factor;
        if (carry % absBase != 0n)
            throw new Error("Assertion failed: Carry is not divisible by base");
        carry /= absBase;
    }
    return prefix + result;
}
