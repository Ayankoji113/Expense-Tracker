#!/usr/bin/env bash
# Fills a local instance with a demo account so the dashboard has something to show.
#   API=http://localhost:8081/api ./sample-data/seed-demo.sh
# Safe to run twice: the account is reused and the CSV import skips its own duplicates.
set -euo pipefail

API="${API:-http://localhost:8080/api}"
DEMO_USER="${DEMO_USER:-demo}"
DEMO_EMAIL="${DEMO_EMAIL:-demo@expense.local}"
DEMO_PASSWORD="${DEMO_PASSWORD:-demo-password-123}"
HERE="$(cd "$(dirname "$0")" && pwd)"

json() { curl -fsS -H 'Content-Type: application/json' "$@"; }
token_of() { sed -n 's/.*"token":"\([^"]*\)".*/\1/p'; }

TOKEN="$(json -X POST "$API/auth/register" \
  -d "{\"email\":\"$DEMO_EMAIL\",\"username\":\"$DEMO_USER\",\"password\":\"$DEMO_PASSWORD\"}" 2>/dev/null | token_of || true)"
if [ -z "$TOKEN" ]; then
  TOKEN="$(json -X POST "$API/auth/login" -d "{\"identifier\":\"$DEMO_USER\",\"password\":\"$DEMO_PASSWORD\"}" | token_of)"
fi
AUTH="Authorization: Bearer $TOKEN"

category_id() {
  curl -fsS -H "$AUTH" "$API/categories" | tr '{' '\n' | sed -n "s/.*\"id\":\([0-9]*\),\"name\":\"$1\".*/\1/p"
}
rule() { json -H "$AUTH" -X POST "$API/categories/rules" -d "{\"keyword\":\"$1\",\"categoryId\":$(category_id "$2")}" >/dev/null 2>&1 || true; }
budget() { json -H "$AUTH" -X POST "$API/budgets" -d "{\"categoryId\":$(category_id "$1"),\"monthlyLimit\":$2}" >/dev/null 2>&1 || true; }
# txn <days ago> <amount> <description> <category or ""> <EXPENSE|INCOME>
txn() {
  local day category="null"
  day="$(date -d "-$1 days" +%F)"
  [ -n "$4" ] && category="$(category_id "$4")"
  json -H "$AUTH" -X POST "$API/expenses" \
    -d "{\"amount\":$2,\"spentOn\":\"$day\",\"description\":\"$3\",\"categoryId\":$category,\"kind\":\"$5\"}" >/dev/null
}

rule "big bazaar" Groceries; rule "dmart" Groceries; rule "uber" Transport; rule "indian oil" Transport
rule "swiggy" Dining; rule "zomato" Dining; rule "blue tokai" Dining; rule "rent" Rent
rule "netflix" Entertainment; rule "spotify" Entertainment; rule "electricity" Utilities
rule "amazon" Shopping; rule "myntra" Shopping; rule "apollo" Health

curl -fsS -H "$AUTH" -F "file=@$HERE/transactions.csv" "$API/expenses/import" >/dev/null

# only add the hand-entered rows once
if ! curl -fsS -H "$AUTH" "$API/expenses?q=Salary" | grep -q '"totalElements":[1-9]'; then
  txn 9 85000 "Salary" "" INCOME
  txn 40 85000 "Salary" "" INCOME
  txn 70 82000 "Salary" "" INCOME
  txn 8 25000 "Rent" Rent EXPENSE
  txn 38 25000 "Rent" Rent EXPENSE
  txn 68 25000 "Rent" Rent EXPENSE
  txn 7 3180 "Big Bazaar groceries" Groceries EXPENSE
  txn 6 420 "Uber to office" Transport EXPENSE
  txn 5 860 "Dinner at Bombay Canteen" Dining EXPENSE
  txn 5 649 "Netflix" Entertainment EXPENSE
  txn 4 2240 "Electricity bill" Utilities EXPENSE
  txn 3 1999 "Running shoes" Shopping EXPENSE
  txn 2 1650 "DMart top-up" Groceries EXPENSE
  txn 1 540 "Blue Tokai coffee beans" Dining EXPENSE
  txn 1 2100 "Indian Oil fuel" Transport EXPENSE
  txn 0 180 "Chai and samosa" Dining EXPENSE
  txn 35 4300 "Weekend trip to Lonavala" Travel EXPENSE
  txn 33 2950 "DMart groceries" Groceries EXPENSE
  txn 30 1200 "Pharmacy" Health EXPENSE
  txn 65 6400 "Diwali shopping" Shopping EXPENSE
  txn 62 3100 "Groceries" Groceries EXPENSE
fi

budget Groceries 6000; budget Dining 2000; budget Transport 4000; budget Shopping 5000

echo "Seeded. Sign in as $DEMO_USER / $DEMO_PASSWORD"
