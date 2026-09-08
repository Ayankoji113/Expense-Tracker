alter table users
    add column username    varchar(30),
    add column age         integer check (age is null or (age between 13 and 120)),
    add column provider    varchar(10) not null default 'LOCAL',
    add column google_sub  varchar(64),
    add column avatar_url  varchar(500);

-- existing accounts get a username from their email local part, de-duplicated by id
update users
set username = regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9_.]', '', 'g') || '_' || id
where username is null;

alter table users
    alter column username set not null,
    add constraint users_password_hash_or_google check (password_hash is not null or google_sub is not null);

alter table users alter column password_hash drop not null;

create unique index users_username_uq on users (lower(username));
create unique index users_google_sub_uq on users (google_sub);
