-- Remove the auto-create "Inbox" project trigger.
-- Tasks can exist without a project. Projects are opt-in.

drop trigger if exists fp_tasks_ensure_default_project on fp_tasks;
drop trigger if exists fp_ensure_default_project_trigger on fp_tasks;
drop function if exists fp_ensure_default_project();
