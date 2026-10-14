# Pending database migrations

The code already uses the new names. The database keeps the old ones until a migration renames them,
so nothing changes on the server until code and migration ship together. Every place that still names
an old column is marked `PENDING-MIGRATION`:

```sh
git grep -n PENDING-MIGRATION
```

When the migration runs, the same deploy must remove each `field: '<old column>'` line from the models
and update the marked raw SQL.

## Rename (columns hold data: rename, never drop and re-add)

| Table | Column now | Column after |
| --- | --- | --- |
| appointments | counselor_id | professional_id |
| appointments | is_counselor_joined | is_professional_joined |
| appointments | is_counselor_canceled | is_professional_canceled |
| availability | counselor_id | professional_id |
| bookings | counselor_id | professional_id |
| bookings | is_counselor_joined | is_professional_joined |
| bookings | is_counselor_canceled | is_professional_canceled |
| booking_slots | counselor_id | professional_id |
| cases | counselor_id | professional_id |
| intervals | counselor_id | professional_id |
| reviews | counselor_id | professional_id |
| rules | counselor_id | professional_id |
| slots | counselor_id | professional_id |
| profiles | no_of_beautician_associated | no_of_professionals_associated |

Raw SQL that names these columns: `src/modules/admin/adminOp.service.js` (reviews.counselor_id) and
`src/modules/admin/dashboard.service.js` (bookings.counselor_id in COUNT and GROUP BY).

## Drop (no longer in any model)

| Table | Columns | Data |
| --- | --- | --- |
| bookings, appointments | call_type, call_end_by, call_start_time, call_end_time, call_duration_in_minuites, counselor_zego_id, user_zego_id, zego_call_id | All empty except call_type, which is always 'VIDEO' |
| users | square_customer_id | Empty |

## Also worth fixing in the same migration

- Table `professiona_payouts` is misspelled (model `ProfessionalPayout`); renaming it means updating the
  model's `tableName`.
