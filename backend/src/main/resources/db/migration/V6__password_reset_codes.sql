create table password_reset_codes (
    id         bigserial primary key,
    user_id    bigint      not null references users (id) on delete cascade,
    code_hash  varchar(100) not null,
    expires_at timestamptz not null,
    attempts   integer     not null default 0,
    used_at    timestamptz,
    created_at timestamptz not null default now()
);

-- the lookup is always "newest live code for this user"
create index password_reset_codes_user_idx on password_reset_codes (user_id, created_at desc);
