-- the interface moved to a paper-and-ink palette; the built-in categories follow it
update categories set color = case name
    when 'Groceries'     then '#4F7A4A'
    when 'Dining'        then '#C4682F'
    when 'Transport'     then '#3D6B8E'
    when 'Rent'          then '#6B4E8A'
    when 'Utilities'     then '#2F8082'
    when 'Shopping'      then '#B5536C'
    when 'Entertainment' then '#A63D2F'
    when 'Health'        then '#5C8F7B'
    when 'Travel'        then '#4A5A9A'
    when 'Uncategorized' then '#8A857A'
    else color
end
where user_id is null;
