"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// const ngeohash = require("ngeohash");
const ngeohash_1 = __importDefault(require("ngeohash"));
// import circle from "@turf/circle";
// import bbox from "@turf/bbox";
const helpers_1 = require("@turf/helpers");
const distance_1 = __importDefault(require("@turf/distance"));
const BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
function isInRadius(from, to, radius) {
    return radius >= distance_1.default(from, to);
}
function getHashesNear(coord, precision, radius) {
    const { latitude, longitude } = coord;
    const origin = helpers_1.point([longitude, latitude]);
    const encodedOrigin = ngeohash_1.default.encode(latitude, longitude, precision);
    const checked = new Set();
    const toCheck = new Set();
    const valid = new Set([encodedOrigin]);
    // ngeohash.neighbors(encodedOrigin).forEach((hash) => {
    //   toCheck.add(hash);
    // });
    for (const hash of ngeohash_1.default.neighbors(encodedOrigin)) {
        toCheck.add(hash);
    }
    while (toCheck.size > 0) {
        const [hash] = Array.from(toCheck);
        const { latitude: destLatitude, longitude: destLongitude, } = ngeohash_1.default.decode(hash);
        const destination = helpers_1.point([destLongitude, destLatitude]);
        if (isInRadius(origin, destination, radius)) {
            valid.add(hash);
            for (const h of ngeohash_1.default.neighbors(hash)) {
                if (!checked.has(h)) {
                    toCheck.add(h);
                }
            }
            // ngeohash
            //   .neighbors(hash)
            //   .filter((d) => !checked.has(d))
            //   .forEach((neighbour) => {
            //     toCheck.add(neighbour);
            //   });
        }
        toCheck.delete(hash);
        checked.add(hash);
    }
    return [...valid];
}
function countHashes(hashes, precision) {
    const cache = {};
    const leafHashes = [];
    for (const hash of hashes) {
        for (let i = 1; i <= hash.length; i++) {
            const prefix = hash.substring(0, i);
            if (prefix.length === precision) {
                leafHashes.push(prefix);
                continue;
            }
            cache[prefix] = (cache[prefix] || 0) + 1;
        }
    }
    return [Object.entries(cache), leafHashes];
}
function findSuperHashes(hashCounts, precision) {
    const superHashes = new Set();
    for (const [prefix, count] of hashCounts) {
        const allCount = Math.pow(BASE32_CODES.length, precision - prefix.length);
        if (count !== 1 && count === allCount) {
            superHashes.add(prefix);
        }
    }
    return superHashes;
}
function filterHashes(hashCounts, superHashes, precision) {
    console.time("filter:filter");
    // const searchRegex = new RegExp([...superHashes]);
    const re = new RegExp([...superHashes].map((s) => `${s}\\w+`).join("|"));
    const filter = hashCounts.filter(([prefix, count]) => {
        const allCount = Math.pow(BASE32_CODES.length, precision - prefix.length);
        if (count !== allCount) {
            return false;
        }
        // let i = 0;
        // const foo = [...superHashes];
        // while (i < foo.length) {
        //   if (prefix !== foo[i] && prefix.startsWith(foo[i])) {
        //     return false;
        //   }
        //   i++;
        // }
        // if (superHashes.has(prefix)) {
        //   return true;
        // }
        if (!superHashes.has(prefix) && re.test(prefix)) {
            return false;
        }
        // for (const superHash of superHashes) {
        //   if (prefix !== superHash && prefix.startsWith(superHash)) {
        //     return false;
        //   }
        // }
        return true;
    });
    console.timeEnd("filter:filter");
    // console.time("filter:sort");
    // const sort = filter.sort(([aKey], [bKey]) => aKey.localeCompare(bKey));
    // console.timeEnd("filter:sort");
    // console.time("filter:map");
    // const map = sort.map(([key]) => key);
    // console.timeEnd("filter:map");
    return filter.map(([key]) => key);
}
function firstChar(word) {
    return word[0];
}
function lastChar(word) {
    return word[word.length - 1];
}
function removeMatchingStem(wordA, wordB) {
    let index = 0;
    for (; index < wordA.length; index++) {
        if (wordA.substring(0, index) !== wordB.substring(0, index)) {
            break;
        }
    }
    return [wordA.substring(index - 1), wordB.substring(index - 1)];
}
function idx(char) {
    return BASE32_CODES.indexOf(char);
}
function all(word, char) {
    return word === char.repeat(word.length);
}
function follows(firstHash, secondHash) {
    const [firstLeaf, secondLeaf] = removeMatchingStem(firstHash, secondHash);
    for (let i = 0; i < Math.max(firstLeaf.length, secondLeaf.length); i++) {
        const diff = idx(secondLeaf[i]) - idx(firstLeaf[i]);
        if (diff === 1 || diff === BASE32_CODES.length) {
            continue;
        }
        if (firstLeaf[i] === lastChar(BASE32_CODES) && !secondLeaf[i]) {
            continue;
        }
        if (secondLeaf[i] === firstChar(BASE32_CODES) && !firstLeaf[i]) {
            continue;
        }
        // if (
        //   i === firstLeaf.length - 1 &&
        //   all(secondLeaf.substring(i), firstChar(BASE32_CODES))
        // ) {
        //   continue;
        // }
        // if (
        //   i === secondLeaf.length - 1 &&
        //   all(firstLeaf.substring(i), lastChar(BASE32_CODES))
        // ) {
        //   continue;
        // }
        return false;
    }
    return true;
    // aa -> ab
    // aa -> aaa (not possible as already removed in previous step)
    // az -> b0
    // ay !-> b0
    // az -> b00
    // azz -> b00
    // az !-> b01
    // azy !-> b00
    // azy !-> b0
    //if (firstHash.length === secondHash.length) {
    //  const lastCharFirstHash = firstHash.charAt(firstHash.length - 1);
    //  const lastCharSecondHash = secondHash.charAt(secondHash.length - 1);
    //  const diff = (BASE32_CODES.indexOf(lastCharSecondHash) - BASE32_CODES.indexOf(lastCharFirstHash))
    //  return diff === 1 || diff === BASE32_CODES.length;
    //}
    // az -> b
    // azz -> b0, azz -> b
    // a -> b, a -> b0
    // return false;
}
function getHashRanges(hashes) {
    const ranges = [];
    for (let i = 0; i < hashes.length; i++) {
        let startHash = hashes[i];
        let endHash = startHash;
        for (let j = i + 1; j < hashes.length; j++) {
            const nextHash = hashes[j];
            // if (!nextHash) {
            //   // End of the line
            //   // ranges.push([startHash, endHash]);
            //   break;
            // }
            if (follows(endHash, nextHash)) {
                endHash = nextHash;
                i = j + 1;
                continue;
            }
            i = j - 1;
            break;
            // if (j === hashes.length - 1) {
            //   ranges.push([startHash, endHash]);
            //   return ranges;
            // }
            // break;
        }
        ranges.push([startHash, endHash]);
    }
    return ranges;
}
function run() {
    // request validation...
    // default precision?
    // https://en.wikipedia.org/wiki/Geohash#Digits_and_precision_in_km
    console.time("total");
    const [lat, long] = [40.6792112, -74.0050316];
    const precision = 12; // max-precision 9
    console.time("getHashesNear");
    const allHashes = getHashesNear({
        latitude: lat,
        longitude: long,
    }, precision, 1e-6);
    console.timeEnd("getHashesNear");
    console.time("hashCounts");
    const [hashCounts, leafHashes] = countHashes(allHashes, precision);
    console.timeEnd("hashCounts");
    console.time("superHashes");
    const superHashes = findSuperHashes(hashCounts, precision);
    console.timeEnd("superHashes");
    console.time("filteredHashes");
    const filteredHashes = filterHashes(hashCounts, superHashes, precision);
    console.timeEnd("filteredHashes");
    const allFilterdHashes = [...filteredHashes, ...leafHashes].sort((a, b) => a.localeCompare(b));
    console.time("hashRanges");
    const hashRanges = getHashRanges(allFilterdHashes);
    console.timeEnd("hashRanges");
    console.timeEnd("total");
    console.log(hashRanges.length);
}
run();
exports.default = run;
// const geohash = getHashesNear(
//   {
//     latitude: lat,
//     longitude: long
//   },
//   6,
//   10,
//   "kilometers"
// );
// // const sortedGeohash = geohash.sort((a, b) => a.localeCompare(b));
//
// console.log({ geohash: geohash.length });
// // console.log({ sortedGeohashCount: geohash.length });
//
// const found = {};
//
// for (const geoHash of geohash) {
//   for (let i = 1; i <= geoHash.length; i++) {
//     const prefix = geoHash.substring(0, i);
//     found[prefix] = (found[prefix] || 0) + 1;
//   }
// }
//
// // console.log(found);
// // console.log(Object.keys(found).length, "found prefix");
//
// // const foo = Object.entries(found).sort(([aKey, _bar], [bKey, _foo]) =>
// //   aKey.localeCompare(bKey)
// // );
// // console.log(foo);
//
// const ignorePrefix = new Set();
// const BASE32_CODES = "0123456789bcdefghjkmnpqrstuvwxyz";
//
// for (const [prefix, count] of Object.entries(found)) {
//   const allCount = Math.pow(
//     BASE32_CODES.length,
//     6 /** magic number?? */ - prefix.length
//   );
//   if (count !== 1 && count === allCount) {
//     ignorePrefix.add(prefix);
//   }
// }
//
// // console.log([...ignorePrefix]);
//
// const filteredFoo = Object.entries(found)
//   .filter(([prefix, count]) => {
//     const allCount = Math.pow(
//       BASE32_CODES.length,
//       6 /** magic number?? */ - prefix.length
//     );
//
//     for (const ignorePrefixItem of ignorePrefix) {
//       if (prefix !== ignorePrefixItem && prefix.startsWith(ignorePrefixItem)) {
//         return false;
//       }
//     }
//
//     if (count !== allCount) {
//       return false;
//     }
//
//     return true;
//   })
//   .sort(([aKey, aValue], [bKey, bValue]) => aKey.localeCompare(bKey))
//   .map(([key]) => key);l
//
// console.log(fflilteredFoo;
// function follows(firstHash, secondHash) {
//   return false;
// }
// const ranges = [];
//
// for (let i = 0; i < filteredFoo.lengthfa; ) {
//   let startHash = filteredFoo[i];
//   let endHash = startHash;
//
//   for (let j = i; j < filteredFoo.length; j++) {
//     console.log(i, j);
//     const nextHash = filteredFoo[j];
//     if (follows(endHash, nextHash)) {
//       endHash = nextHash;
//       continue;
//     }
//
//     i = j;
//     break;
//   }
//
//   ranges.push([startHash, endHash]);
// }
//
// console.log({ ranges });
//
// // console.log(Object.entries(foo).length);
//
// // console.log(geohash.length, "geohash cells");
// // console.log(geohash[0], "ex-geohash");
// // console.log(geohash_integers.length, "geohash_int cells");
// // const [a, b, c, d, e, f, g, h, i, j, ...rest] = geohash_integers;
// // console.log(a, b, c, d, e, f, g, h, i, j);
//
// // console.log({ ranges: getHashRanges(geohash_integers) });
//
//# sourceMappingURL=index.js.map