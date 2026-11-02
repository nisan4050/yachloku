export const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// SQL fragment: is the user in $n a member of events alias `e`? Params are compared as text.
export const memberClause = (n) =>
  `(e.created_by::text = $${n}::text or e.manager_user_id::text = $${n}::text or e.participants @> jsonb_build_array(jsonb_build_object('user_id', $${n}::text)))`;

export async function getMemberEvent(pool, eventId, userId) {
  const { rows } = await pool.query(`select e.* from events e where e.id = $1 and ${memberClause(2)}`, [eventId, userId]);
  return rows[0] ?? null;
}

// jsonb columns need JSON text; the pg driver would turn JS arrays into PG arrays.
export const jsonVal = (v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : v);

export function pick(body, allowed) {
  const out = {};
  for (const k of allowed) if (body && body[k] !== undefined) out[k] = jsonVal(body[k]);
  return out;
}

export function insertSql(table, values) {
  const cols = Object.keys(values);
  const params = cols.map((_, i) => `$${i + 1}`);
  return { sql: `insert into ${table} (${cols.join(', ')}) values (${params.join(', ')}) returning *`, args: Object.values(values) };
}

export function updateSql(table, values, whereCol, whereArgIndex) {
  const cols = Object.keys(values);
  const sets = cols.map((c, i) => `${c} = $${i + 1}`).join(', ');
  return { sql: `update ${table} set ${sets} where ${whereCol} = $${cols.length + 1} returning *`, args: [...Object.values(values), whereArgIndex] };
}
