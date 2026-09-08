create table users (
    id            bigserial primary key,
    email         varchar(255) not null unique,
    password_hash varchar(100) not null,
    created_at    timestamptz  not null default now()
);

-- user_id null = built-in category shared by everyone
create table categories (
    id      bigserial primary key,
    user_id bigint references users (id) on delete cascade,
    name    varchar(60) not null,
    color   varchar(7)  not null default '#888888'
);
create unique index categories_user_name_uq on categories (coalesce(user_id, 0), lower(name));

create table expenses (
    id          bigserial primary key,
    user_id     bigint         not null references users (id) on delete cascade,
    category_id bigint         references categories (id) on delete set null,
    amount      numeric(12, 2) not null check (amount > 0),
    spent_on    date           not null,
    description varchar(255)   not null,
    source      varchar(10)    not null default 'MANUAL',
    created_at  timestamptz    not null default now()
);
create index expenses_user_date_idx on expenses (user_id, spent_on desc);
-- backs the CSV duplicate guard
create unique index expenses_dedupe_uq on expenses (user_id, spent_on, amount, lower(description));

create table category_rules (
    id          bigserial primary key,
    user_id     bigint      not null references users (id) on delete cascade,
    keyword     varchar(60) not null,
    category_id bigint      not null references categories (id) on delete cascade
);
create unique index category_rules_user_keyword_uq on category_rules (user_id, lower(keyword));
