-- The duplicate guard exists so re-uploading a bank file changes nothing. Applied to every row it also
-- rejected a second identical coffee typed in by hand on the same day, which is a real transaction.
drop index expenses_dedupe_uq;
create unique index expenses_dedupe_uq on expenses (user_id, spent_on, amount, lower(description))
    where source = 'CSV';
