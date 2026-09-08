-- transactions are expenses unless marked otherwise
alter table expenses
    add column kind varchar(10) not null default 'EXPENSE';

create index expenses_user_kind_date_idx on expenses (user_id, kind, spent_on desc);

create table budgets (
    id            bigserial primary key,
    user_id       bigint         not null references users (id) on delete cascade,
    category_id   bigint         not null references categories (id) on delete cascade,
    monthly_limit numeric(12, 2) not null check (monthly_limit > 0),
    created_at    timestamptz    not null default now(),
    unique (user_id, category_id)
);
