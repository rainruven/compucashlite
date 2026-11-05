import {dayBounds,localHour} from "./src/lib/time";
import {calcTotals} from "./src/lib/totals";
import {parseCsv} from "./src/lib/csv";
console.log(dayBounds("2026-11-05").map(d=>d.toISOString()), dayBounds("2026-07-01").map(d=>d.toISOString()), localHour(new Date("2026-11-05T22:30:00Z")));
console.log(JSON.stringify(calcTotals([{unitPrice:5.5,quantity:2,vatRate:24},{unitPrice:2.9,quantity:1,vatRate:24}])));
console.log(JSON.stringify(parseCsv("category,name,price
Joogid,\"Vesi, 0.5l\",2.20
")));
