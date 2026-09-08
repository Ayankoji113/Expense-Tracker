-- match the built-in categories to the app's chart palette
update categories set color = case name
    when 'Groceries'     then '#059669'
    when 'Dining'        then '#EA580C'
    when 'Transport'     then '#2563EB'
    when 'Rent'          then '#7C3AED'
    when 'Utilities'     then '#0891B2'
    when 'Shopping'      then '#DB2777'
    when 'Entertainment' then '#DC2626'
    when 'Health'        then '#0D9488'
    when 'Travel'        then '#4F46E5'
    when 'Uncategorized' then '#64748B'
    else color
end
where user_id is null;
