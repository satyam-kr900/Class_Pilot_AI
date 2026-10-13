"""AI insights placeholder — aage LLM se jodna."""
def fee_reminder_insight(pending: int) -> str:
    if pending <= 0:
        return "Sab fees clear hai. Great!"
    return f"{pending} students pending hain — kal subah reminder bhejo, recovery ~18% badhti hai."
