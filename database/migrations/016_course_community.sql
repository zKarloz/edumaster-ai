BEGIN;
-- Comunidad privada por oferta, sin acceso directo desde el cliente.
CREATE TABLE app.community_posts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL, offering_id uuid NOT NULL,
 author_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
 kind text NOT NULL CHECK (kind IN ('announcement','question')),
 title text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 150),
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 5 AND 3000),
 created_at timestamptz NOT NULL DEFAULT now(), hidden_at timestamptz,
 UNIQUE (organization_id,offering_id,id),
 FOREIGN KEY (organization_id,offering_id) REFERENCES app.course_offerings(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.community_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id uuid NOT NULL, offering_id uuid NOT NULL, post_id uuid NOT NULL,
 author_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
 body text NOT NULL CHECK (length(btrim(body)) BETWEEN 2 AND 2000),
 created_at timestamptz NOT NULL DEFAULT now(), hidden_at timestamptz,
 FOREIGN KEY (organization_id,offering_id,post_id) REFERENCES app.community_posts(organization_id,offering_id,id) ON DELETE RESTRICT
);
CREATE TABLE app.community_reactions (
 organization_id uuid NOT NULL, offering_id uuid NOT NULL, post_id uuid NOT NULL,
 author_id uuid NOT NULL REFERENCES app.users(id) ON DELETE RESTRICT,
 PRIMARY KEY (organization_id,offering_id,post_id,author_id),
 FOREIGN KEY (organization_id,offering_id,post_id) REFERENCES app.community_posts(organization_id,offering_id,id) ON DELETE RESTRICT
);
CREATE INDEX community_posts_feed_idx ON app.community_posts(organization_id,offering_id,created_at DESC);
CREATE INDEX community_comments_post_idx ON app.community_comments(organization_id,offering_id,post_id,created_at);
ALTER TABLE app.community_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.community_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE app.community_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.community_comments FORCE ROW LEVEL SECURITY;
ALTER TABLE app.community_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.community_reactions FORCE ROW LEVEL SECURITY;
REVOKE ALL ON app.community_posts, app.community_comments, app.community_reactions FROM PUBLIC, anon, authenticated;
COMMIT;
