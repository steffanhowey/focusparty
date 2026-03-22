-- Explicit mapping between canonical mission briefs and hidden compatibility path rows.

CREATE TABLE fp_mission_path_projections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_brief_id UUID NOT NULL REFERENCES fp_mission_briefs(id),
  learning_path_id UUID NOT NULL REFERENCES fp_learning_paths(id),
  projector_version TEXT NOT NULL,
  projection_status TEXT NOT NULL CHECK (projection_status IN ('active', 'superseded', 'failed')),
  projected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  superseded_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE fp_mission_path_projections ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX fp_mission_path_projections_brief_uidx
  ON fp_mission_path_projections(mission_brief_id);

CREATE UNIQUE INDEX fp_mission_path_projections_path_uidx
  ON fp_mission_path_projections(learning_path_id);

CREATE INDEX fp_mission_path_projections_status_idx
  ON fp_mission_path_projections(projection_status, projected_at DESC);
