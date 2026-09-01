const restoreMinistryLeaveAssignments = async (
  client,
  userId,
  ministryId
) => {
  const requestsResult = await client.query(
    `
      SELECT id, assignment_id, previous_assignment_status
      FROM assignment_change_requests
      WHERE subject_user_id = $1
        AND ministry_id = $2
        AND request_type = 'substitute'
        AND request_source = 'ministry_leave'
        AND status = 'pending'
      FOR UPDATE
    `,
    [userId, ministryId]
  )
  if (!requestsResult.rowCount) return 0

  const requestIds = requestsResult.rows.map((request) => request.id)
  for (const request of requestsResult.rows) {
    await client.query(
      `
        UPDATE responsibility_assignments
        SET status = $1, updated_at = now()
        WHERE id = $2
          AND status = 'change_requested'
      `,
      [request.previous_assignment_status || "assigned", request.assignment_id]
    )
  }
  await client.query(
    `
      UPDATE assignment_substitution_offers
      SET status = 'closed', responded_at = now(), updated_at = now()
      WHERE change_request_id = ANY($1::UUID[])
        AND status = 'offered'
    `,
    [requestIds]
  )
  await client.query(
    `
      UPDATE assignment_change_requests
      SET status = 'cancelled', resolved_at = now(),
        resolution_note = 'Membership reactivated before substitution',
        updated_at = now()
      WHERE id = ANY($1::UUID[])
    `,
    [requestIds]
  )
  return requestsResult.rowCount
}

module.exports = { restoreMinistryLeaveAssignments }
