

CREATE ROLE osr_migrator LOGIN PASSWORD '';
CREATE ROLE osr_app_rw LOGIN PASSWORD '';
CREATE ROLE osr_export_ro LOGIN PASSWORD '';
CREATE ROLE osr_admin_ro LOGIN PASSWORD '';

GRANT CONNECT ON DATABASE neondb TO osr_migrator, osr_app_rw, osr_export_ro, osr_admin_ro;
GRANT USAGE ON SCHEMA public TO osr_migrator, osr_app_rw, osr_export_ro, osr_admin_ro;

REVOKE CREATE ON SCHEMA public FROM PUBLIC;
REVOKE CREATE ON SCHEMA public FROM osr_app_rw, osr_export_ro, osr_admin_ro;
GRANT CREATE ON SCHEMA public TO osr_migrator;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO osr_app_rw;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO osr_app_rw;

GRANT SELECT ON public_sheet_news_posts TO osr_export_ro, osr_admin_ro;
GRANT SELECT ON public_sheet_commute_routes TO osr_export_ro, osr_admin_ro;
GRANT SELECT ON public_sheet_directory_entries TO osr_export_ro, osr_admin_ro;
GRANT SELECT ON public_sheet_quick_links TO osr_export_ro, osr_admin_ro;
GRANT SELECT ON public_sheet_hub_guides TO osr_export_ro, osr_admin_ro;

GRANT SELECT ON ALL TABLES IN SCHEMA public TO osr_admin_ro;

ALTER DEFAULT PRIVILEGES FOR ROLE osr_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO osr_app_rw;

ALTER DEFAULT PRIVILEGES FOR ROLE osr_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO osr_app_rw;
