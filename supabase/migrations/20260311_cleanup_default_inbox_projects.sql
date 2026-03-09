-- Clean up auto-created "Inbox" projects that were created by the now-removed trigger.
-- First unlink any tasks pointing to these projects, then delete the projects.

update fp_tasks
set project_id = null
where project_id in (select id from fp_projects where is_default = true);

delete from fp_projects where is_default = true;
