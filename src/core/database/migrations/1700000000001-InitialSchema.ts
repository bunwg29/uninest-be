import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1700000000001 implements MigrationInterface {
  name = 'InitialSchema1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      return;
    }

    await queryRunner.query(`
            CREATE TABLE "permissions" (
                "id" smallint GENERATED ALWAYS AS IDENTITY NOT NULL,
                "code" character varying(50) NOT NULL,
                "name" character varying(70) NOT NULL,
                "module" character varying(30) NOT NULL,
                "description" character varying(150),
                CONSTRAINT "UQ_8dad765629e83229da6feda1c1d" UNIQUE ("code"),
                CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_permissions_code" ON "permissions" ("code")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_permissions_module" ON "permissions" ("module")
        `);
    await queryRunner.query(`
            CREATE TABLE "role_permissions" (
                "role_id" smallint NOT NULL,
                "permission_id" smallint NOT NULL,
                CONSTRAINT "PK_25d24010f53bb80b78e412c9656" PRIMARY KEY ("role_id", "permission_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "roles" (
                "id" smallint NOT NULL,
                "code" character varying(20) NOT NULL,
                "name" character varying(50) NOT NULL,
                "description" character varying(150),
                CONSTRAINT "UQ_f6d54f95c31b73fb1bdd8e91d0c" UNIQUE ("code"),
                CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "users" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "email" character varying(150),
                "phone" character varying(15),
                "password_hash" character varying(72),
                "full_name" character varying(70) NOT NULL,
                "avatar_url" character varying(255),
                "phone_verified" boolean NOT NULL DEFAULT false,
                "school" character varying(255),
                "bio" character varying(300),
                "interested_areas" text array,
                "role_id" smallint NOT NULL DEFAULT '0',
                "is_active" boolean NOT NULL DEFAULT true,
                "is_verified" boolean NOT NULL DEFAULT false,
                "identity_number" character varying(20),
                "landlord_verified_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "province_code" character varying(20),
                "ward_code" character varying(20),
                "street_address" character varying(255),
                "full_address" character varying(500),
                CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"),
                CONSTRAINT "UQ_a000cca60bcf04454e727699490" UNIQUE ("phone"),
                CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email")
            WHERE email IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_users_phone" ON "users" ("phone")
            WHERE phone IS NOT NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_users_role_id" ON "users" ("role_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "refresh_tokens" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "user_id" uuid NOT NULL,
                "token_hash" character varying(64) NOT NULL,
                "device_name" character varying(100),
                "device_id" character varying(100),
                "ip_address" character varying(45),
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "is_revoked" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_a7838d2ba25be1342091b6695f1" UNIQUE ("token_hash"),
                CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens" ("token_hash")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_refresh_tokens_device_id" ON "refresh_tokens" ("device_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_refresh_tokens_revoked" ON "refresh_tokens" ("is_revoked")
        `);
    await queryRunner.query(`
            CREATE TABLE "otp_codes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "identifier" character varying(150) NOT NULL,
                "code_hash" character varying(64) NOT NULL,
                "type" character varying(20) NOT NULL DEFAULT 'REGISTER',
                "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
                "is_used" boolean NOT NULL DEFAULT false,
                "attempts" smallint NOT NULL DEFAULT '0',
                "locked_until" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9d0487965ac1837d57fec4d6a26" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_otp_codes_identifier" ON "otp_codes" ("identifier")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_otp_codes_is_used" ON "otp_codes" ("is_used")
        `);
    await queryRunner.query(`
            CREATE TABLE "listing_images" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "url" character varying(1000) NOT NULL,
                "is_cover" boolean NOT NULL DEFAULT false,
                "sort_order" smallint NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_2abb5c9d795f27dbc4b10ced9dc" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listing_images_listing_id" ON "listing_images" ("listing_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "universities" (
                "code" character varying(20) NOT NULL,
                "name" character varying(255) NOT NULL,
                CONSTRAINT "PK_a3e80913c5f263361d680fd7b43" PRIMARY KEY ("code")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "listing_universities" (
                "listing_id" uuid NOT NULL,
                "university_code" character varying(20) NOT NULL,
                "position" smallint NOT NULL DEFAULT '0',
                CONSTRAINT "PK_7922e54ef58f0b1e6267c987da3" PRIMARY KEY ("listing_id", "university_code")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listing_universities_university" ON "listing_universities" ("university_code")
        `);
    await queryRunner.query(`
            CREATE TABLE "favorites" (
                "user_id" uuid NOT NULL,
                "listing_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_0f8db9b83a100398d2611a8c9d0" PRIMARY KEY ("user_id", "listing_id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_favorites_listing_id" ON "favorites" ("listing_id")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."listings_status_enum" AS ENUM(
                'pending',
                'active',
                'rejected',
                'hidden',
                'rented',
                'paused'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "listings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "owner_id" uuid NOT NULL,
                "title" character varying(150) NOT NULL,
                "description" text,
                "room_type" character varying(50) NOT NULL,
                "price" numeric(12, 0) NOT NULL,
                "area" numeric(8, 2) NOT NULL,
                "max_occupants" smallint NOT NULL,
                "electric_price" numeric(12, 0),
                "water_price" numeric(12, 0),
                "deposit" numeric(12, 0),
                "video_key" character varying(255),
                "street_address" character varying(255) NOT NULL,
                "province_code" character varying(20) NOT NULL,
                "ward_code" character varying(20) NOT NULL,
                "full_address" character varying(500) NOT NULL,
                "location" geometry(Point, 4326) NOT NULL,
                "viewing_schedule" jsonb,
                "status" "public"."listings_status_enum" NOT NULL DEFAULT 'pending',
                "view_count" integer NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_520ecac6c99ec90bcf5a603cdcb" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_owner_id" ON "listings" ("owner_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_province_code" ON "listings" ("province_code")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_ward_code" ON "listings" ("ward_code")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_location" ON "listings" USING gist ("location")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_status" ON "listings" ("status")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listings_active_created_at" ON "listings" ("created_at", "id")
            WHERE status = 'active' AND deleted_at IS NULL
        `);
    await queryRunner.query(`
            CREATE TABLE "listing_amenities" (
                "listing_id" uuid NOT NULL,
                "amenity_id" smallint NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_c630b140853ba36dcfa1938cd6a" PRIMARY KEY ("listing_id", "amenity_id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "amenities" (
                "id" smallint NOT NULL,
                "name" character varying(80) NOT NULL,
                "group" smallint NOT NULL DEFAULT '0',
                "is_active" boolean NOT NULL DEFAULT true,
                CONSTRAINT "UQ_8c5f9c7ff7e2174b53d4be10247" UNIQUE ("name"),
                CONSTRAINT "PK_c0777308847b3556086f2fb233e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "listing_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "reporter_id" uuid NOT NULL,
                "reason" character varying(30) NOT NULL,
                "note" character varying(500),
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "uq_listing_reports_listing_reporter" UNIQUE ("listing_id", "reporter_id"),
                CONSTRAINT "PK_943442134a31338529a1cf22ba5" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listing_reports_listing" ON "listing_reports" ("listing_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "listing_views" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "viewer_id" uuid,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5d631d8af94d7825897d10a3e87" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listing_views_listing_viewer_created" ON "listing_views" ("listing_id", "viewer_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_listing_views_listing_created" ON "listing_views" ("listing_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."bookings_status_enum" AS ENUM(
                'pending',
                'confirmed',
                'holding',
                'expired',
                'cancelled',
                'rejected'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "bookings" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "code" character varying(50) NOT NULL,
                "listing_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "phone" character varying(10) NOT NULL,
                "start_time" TIMESTAMP WITH TIME ZONE NOT NULL,
                "end_time" TIMESTAMP WITH TIME ZONE NOT NULL,
                "status" "public"."bookings_status_enum" NOT NULL DEFAULT 'pending',
                "expires_at" TIMESTAMP WITH TIME ZONE,
                "note" text,
                "cancel_reason" text,
                "deposit_amount" numeric(12, 0),
                "confirmed_at" TIMESTAMP WITH TIME ZONE,
                "expired_at" TIMESTAMP WITH TIME ZONE,
                "rejected_at" TIMESTAMP WITH TIME ZONE,
                "cancelled_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "UQ_9add00bfd42ae2bbe830bab9aa2" UNIQUE ("code"),
                CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "idx_bookings_code" ON "bookings" ("code")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_bookings_one_holding_per_listing" ON "bookings" ("listing_id")
            WHERE "status" = 'holding'
                AND "deleted_at" IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_bookings_user_status" ON "bookings" ("user_id", "status")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_bookings_status_expires" ON "bookings" ("status", "expires_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_bookings_listing_time" ON "bookings" ("listing_id", "start_time", "end_time")
        `);
    await queryRunner.query(`
            CREATE TABLE "booking_events" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "booking_id" uuid NOT NULL,
                "event_type" character varying(50) NOT NULL,
                "actor" character varying(20),
                "metadata" jsonb,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_bb7037dff63ec344eba13da5d0b" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."messages_type_enum" AS ENUM('text', 'image')
        `);
    await queryRunner.query(`
            CREATE TABLE "messages" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "conversation_id" uuid NOT NULL,
                "sender_id" uuid NOT NULL,
                "client_message_id" uuid NOT NULL,
                "type" "public"."messages_type_enum" NOT NULL DEFAULT 'text',
                "content" text,
                "image_keys" text array NOT NULL DEFAULT '{}',
                "read_at" TIMESTAMP WITH TIME ZONE,
                "recalled_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_18325f38ae6de43878487eff986" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_messages_unread" ON "messages" ("conversation_id")
            WHERE read_at IS NULL
                AND recalled_at IS NULL
                AND deleted_at IS NULL
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_messages_conversation_created" ON "messages" ("conversation_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_messages_client_message" ON "messages" (
                "conversation_id",
                "sender_id",
                "client_message_id"
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "conversations" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "listing_id" uuid NOT NULL,
                "student_id" uuid NOT NULL,
                "landlord_id" uuid NOT NULL,
                "last_message_at" TIMESTAMP WITH TIME ZONE,
                "student_deleted_at" TIMESTAMP WITH TIME ZONE,
                "landlord_deleted_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_ee34f4f7ced4ec8681f26bf04ef" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_conversations_student_id" ON "conversations" ("student_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_conversations_landlord_id" ON "conversations" ("landlord_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_conversations_listing_student" ON "conversations" ("listing_id", "student_id")
            WHERE deleted_at IS NULL
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_banned_keywords_action_enum" AS ENUM('warn', 'block')
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_banned_keywords" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "keyword" character varying(100) NOT NULL,
                "action" "public"."forum_banned_keywords_action_enum" NOT NULL DEFAULT 'block',
                "is_active" boolean NOT NULL DEFAULT true,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "UQ_6e2953e0c6e11ebce6f6f64a0a0" UNIQUE ("keyword"),
                CONSTRAINT "PK_29af2f897a9cfae992a677a84f7" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_posts_category_enum" AS ENUM(
                'roommate',
                'experience',
                'question',
                'area_review'
            )
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_posts_roommate_status_enum" AS ENUM('open', 'full')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_posts_status_enum" AS ENUM('draft', 'published', 'hidden')
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_posts" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "author_id" uuid NOT NULL,
                "category" "public"."forum_posts_category_enum" NOT NULL,
                "title" character varying(150) NOT NULL,
                "content" text NOT NULL,
                "image_keys" text array NOT NULL DEFAULT '{}',
                "roommate" jsonb,
                "roommate_status" "public"."forum_posts_roommate_status_enum",
                "status" "public"."forum_posts_status_enum" NOT NULL DEFAULT 'published',
                "like_count" integer NOT NULL DEFAULT '0',
                "comment_count" integer NOT NULL DEFAULT '0',
                "view_count" integer NOT NULL DEFAULT '0',
                "report_count" integer NOT NULL DEFAULT '0',
                "moderation_flags" text array NOT NULL DEFAULT '{}',
                "published_at" TIMESTAMP WITH TIME ZONE,
                "hidden_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_3e9c301114a0fd42c998681b04e" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_posts_author_id" ON "forum_posts" ("author_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_posts_feed" ON "forum_posts" ("status", "category", "published_at")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_comments_status_enum" AS ENUM('published', 'hidden')
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_comments" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "post_id" uuid NOT NULL,
                "author_id" uuid NOT NULL,
                "parent_id" uuid,
                "content" text NOT NULL,
                "status" "public"."forum_comments_status_enum" NOT NULL DEFAULT 'published',
                "report_count" integer NOT NULL DEFAULT '0',
                "moderation_flags" text array NOT NULL DEFAULT '{}',
                "hidden_at" TIMESTAMP WITH TIME ZONE,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                "deleted_at" TIMESTAMP WITH TIME ZONE,
                CONSTRAINT "PK_1c860feac1713d199c00ce1e9d1" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_comments_author_id" ON "forum_comments" ("author_id")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_comments_parent_created" ON "forum_comments" ("parent_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_comments_post_created" ON "forum_comments" ("post_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_likes" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "post_id" uuid NOT NULL,
                "user_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_9feaf1887b12844e95c35facaa5" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_likes_user_id" ON "forum_likes" ("user_id")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_forum_likes_post_user" ON "forum_likes" ("post_id", "user_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_post_views" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "post_id" uuid NOT NULL,
                "viewer_id" uuid NOT NULL,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_77934fd613d62b41cecad8a50ae" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_post_views_post_viewer_created" ON "forum_post_views" ("post_id", "viewer_id", "created_at")
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_reports_target_type_enum" AS ENUM('post', 'comment')
        `);
    await queryRunner.query(`
            CREATE TYPE "public"."forum_reports_reason_enum" AS ENUM(
                'scam',
                'false_information',
                'contact_information',
                'harassment',
                'spam',
                'other'
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "forum_reports" (
                "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
                "reporter_id" uuid NOT NULL,
                "target_type" "public"."forum_reports_target_type_enum" NOT NULL,
                "target_id" uuid NOT NULL,
                "reason" "public"."forum_reports_reason_enum" NOT NULL,
                "note" character varying(500),
                "is_resolved" boolean NOT NULL DEFAULT false,
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_5f7331fedc27ce128560be79041" PRIMARY KEY ("id")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_forum_reports_target" ON "forum_reports" ("target_type", "target_id", "is_resolved")
        `);
    await queryRunner.query(`
            CREATE UNIQUE INDEX "uq_forum_reports_reporter_target" ON "forum_reports" ("reporter_id", "target_type", "target_id")
        `);
    await queryRunner.query(`
            CREATE TABLE "provinces" (
                "code" character varying(20) NOT NULL,
                "name" character varying(100) NOT NULL,
                "full_name" character varying(150) NOT NULL,
                "code_name" character varying(100) NOT NULL,
                CONSTRAINT "PK_f4b684af62d5cb3aa174f6b9b8a" PRIMARY KEY ("code")
            )
        `);
    await queryRunner.query(`
            CREATE TABLE "wards" (
                "code" character varying(20) NOT NULL,
                "name" character varying(100) NOT NULL,
                "full_name" character varying(150) NOT NULL,
                "code_name" character varying(100) NOT NULL,
                "province_code" character varying(20) NOT NULL,
                "postal_code" character varying(20),
                CONSTRAINT "PK_24f16d2207b1dcb6ce07d81d20f" PRIMARY KEY ("code")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_wards_province_code" ON "wards" ("province_code")
        `);
    await queryRunner.query(`
            CREATE TABLE "user_universities" (
                "user_id" uuid NOT NULL,
                "university_code" character varying(20) NOT NULL,
                "position" smallint NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
                CONSTRAINT "PK_adc1dce6ae48d4aa0932905e0d0" PRIMARY KEY ("user_id", "university_code")
            )
        `);
    await queryRunner.query(`
            CREATE INDEX "idx_user_universities_university" ON "user_universities" ("university_code")
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions"
            ADD CONSTRAINT "FK_178199805b901ccd220ab7740ec" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions"
            ADD CONSTRAINT "FK_17022daf3f885f7d35423e9971e" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_28f26049b825f2dc4b6a62bfd1a" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_7f401ba4fa7f61f6dd327d3c164" FOREIGN KEY ("ward_code") REFERENCES "wards"("code") ON DELETE
            SET NULL ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "users"
            ADD CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "refresh_tokens"
            ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_images"
            ADD CONSTRAINT "FK_94041359df3c1b14c4420808d16" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_universities"
            ADD CONSTRAINT "FK_f58b68423037b48c34f35a5e595" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_universities"
            ADD CONSTRAINT "FK_f3eb956ef4d9717fbfa939917f9" FOREIGN KEY ("university_code") REFERENCES "universities"("code") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "favorites"
            ADD CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "favorites"
            ADD CONSTRAINT "FK_74e0699c35d78e39b229d64f34f" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listings"
            ADD CONSTRAINT "FK_9f5b6113628f91bcf8a8e2dfa3c" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listings"
            ADD CONSTRAINT "FK_e2bdcd6b53169654bc6688973e9" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listings"
            ADD CONSTRAINT "FK_3dffa3396082c1947809a3eaaee" FOREIGN KEY ("ward_code") REFERENCES "wards"("code") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_amenities"
            ADD CONSTRAINT "FK_cdd6875fe6fc870e4db2139b776" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_amenities"
            ADD CONSTRAINT "FK_8b046c936f07781b43d87c34c71" FOREIGN KEY ("amenity_id") REFERENCES "amenities"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_reports"
            ADD CONSTRAINT "FK_bada7fe237f27edb6e4bd8de9c2" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_reports"
            ADD CONSTRAINT "FK_721e2a6671d47a815b62ca81d64" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_views"
            ADD CONSTRAINT "FK_8dd1398aa912e11f24f18dc3bcc" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "bookings"
            ADD CONSTRAINT "FK_4514952fd3af4b4fd051e378859" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "bookings"
            ADD CONSTRAINT "FK_64cd97487c5c42806458ab5520c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "booking_events"
            ADD CONSTRAINT "FK_f71c073e8e26aca6917ea146c80" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "messages"
            ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "messages"
            ADD CONSTRAINT "FK_22133395bd13b970ccd0c34ab22" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations"
            ADD CONSTRAINT "FK_c14948d6807e84b810dd4bed949" FOREIGN KEY ("listing_id") REFERENCES "listings"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations"
            ADD CONSTRAINT "FK_be873db54abf38df80d07f5481e" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations"
            ADD CONSTRAINT "FK_ff2c5ebee8e4028d991322099d2" FOREIGN KEY ("landlord_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_posts"
            ADD CONSTRAINT "FK_141ee222adc1090094e49486a00" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_comments"
            ADD CONSTRAINT "FK_274dc9abde99249ab89a47789b2" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_comments"
            ADD CONSTRAINT "FK_8e7d4ffc2c0ccb3087e2d590c57" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_likes"
            ADD CONSTRAINT "FK_1e5240dba42a6c0039b52b9f429" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_post_views"
            ADD CONSTRAINT "FK_817ed8a00261f1c38efe295af03" FOREIGN KEY ("post_id") REFERENCES "forum_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "wards"
            ADD CONSTRAINT "FK_6c3a8d384c72ec02bd6dc0ebfef" FOREIGN KEY ("province_code") REFERENCES "provinces"("code") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user_universities"
            ADD CONSTRAINT "FK_dea80d82cbe6140eb7d204384ad" FOREIGN KEY ("university_code") REFERENCES "universities"("code") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
    await queryRunner.query(`
            ALTER TABLE "user_universities"
            ADD CONSTRAINT "FK_6c5ef9b0bda1a7362292778b3c8" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            ALTER TABLE "user_universities" DROP CONSTRAINT "FK_6c5ef9b0bda1a7362292778b3c8"
        `);
    await queryRunner.query(`
            ALTER TABLE "user_universities" DROP CONSTRAINT "FK_dea80d82cbe6140eb7d204384ad"
        `);
    await queryRunner.query(`
            ALTER TABLE "wards" DROP CONSTRAINT "FK_6c3a8d384c72ec02bd6dc0ebfef"
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_post_views" DROP CONSTRAINT "FK_817ed8a00261f1c38efe295af03"
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_likes" DROP CONSTRAINT "FK_1e5240dba42a6c0039b52b9f429"
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_comments" DROP CONSTRAINT "FK_8e7d4ffc2c0ccb3087e2d590c57"
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_comments" DROP CONSTRAINT "FK_274dc9abde99249ab89a47789b2"
        `);
    await queryRunner.query(`
            ALTER TABLE "forum_posts" DROP CONSTRAINT "FK_141ee222adc1090094e49486a00"
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations" DROP CONSTRAINT "FK_ff2c5ebee8e4028d991322099d2"
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations" DROP CONSTRAINT "FK_be873db54abf38df80d07f5481e"
        `);
    await queryRunner.query(`
            ALTER TABLE "conversations" DROP CONSTRAINT "FK_c14948d6807e84b810dd4bed949"
        `);
    await queryRunner.query(`
            ALTER TABLE "messages" DROP CONSTRAINT "FK_22133395bd13b970ccd0c34ab22"
        `);
    await queryRunner.query(`
            ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"
        `);
    await queryRunner.query(`
            ALTER TABLE "booking_events" DROP CONSTRAINT "FK_f71c073e8e26aca6917ea146c80"
        `);
    await queryRunner.query(`
            ALTER TABLE "bookings" DROP CONSTRAINT "FK_64cd97487c5c42806458ab5520c"
        `);
    await queryRunner.query(`
            ALTER TABLE "bookings" DROP CONSTRAINT "FK_4514952fd3af4b4fd051e378859"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_views" DROP CONSTRAINT "FK_8dd1398aa912e11f24f18dc3bcc"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_reports" DROP CONSTRAINT "FK_721e2a6671d47a815b62ca81d64"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_reports" DROP CONSTRAINT "FK_bada7fe237f27edb6e4bd8de9c2"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_amenities" DROP CONSTRAINT "FK_8b046c936f07781b43d87c34c71"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_amenities" DROP CONSTRAINT "FK_cdd6875fe6fc870e4db2139b776"
        `);
    await queryRunner.query(`
            ALTER TABLE "listings" DROP CONSTRAINT "FK_3dffa3396082c1947809a3eaaee"
        `);
    await queryRunner.query(`
            ALTER TABLE "listings" DROP CONSTRAINT "FK_e2bdcd6b53169654bc6688973e9"
        `);
    await queryRunner.query(`
            ALTER TABLE "listings" DROP CONSTRAINT "FK_9f5b6113628f91bcf8a8e2dfa3c"
        `);
    await queryRunner.query(`
            ALTER TABLE "favorites" DROP CONSTRAINT "FK_74e0699c35d78e39b229d64f34f"
        `);
    await queryRunner.query(`
            ALTER TABLE "favorites" DROP CONSTRAINT "FK_35a6b05ee3b624d0de01ee50593"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_universities" DROP CONSTRAINT "FK_f3eb956ef4d9717fbfa939917f9"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_universities" DROP CONSTRAINT "FK_f58b68423037b48c34f35a5e595"
        `);
    await queryRunner.query(`
            ALTER TABLE "listing_images" DROP CONSTRAINT "FK_94041359df3c1b14c4420808d16"
        `);
    await queryRunner.query(`
            ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_a2cecd1a3531c0b041e29ba46e1"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_7f401ba4fa7f61f6dd327d3c164"
        `);
    await queryRunner.query(`
            ALTER TABLE "users" DROP CONSTRAINT "FK_28f26049b825f2dc4b6a62bfd1a"
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_17022daf3f885f7d35423e9971e"
        `);
    await queryRunner.query(`
            ALTER TABLE "role_permissions" DROP CONSTRAINT "FK_178199805b901ccd220ab7740ec"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_user_universities_university"
        `);
    await queryRunner.query(`
            DROP TABLE "user_universities"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_wards_province_code"
        `);
    await queryRunner.query(`
            DROP TABLE "wards"
        `);
    await queryRunner.query(`
            DROP TABLE "provinces"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_forum_reports_reporter_target"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_reports_target"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_reports"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_reports_reason_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_reports_target_type_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_post_views_post_viewer_created"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_post_views"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_forum_likes_post_user"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_likes_user_id"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_likes"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_comments_post_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_comments_parent_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_comments_author_id"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_comments"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_comments_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_posts_feed"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_forum_posts_author_id"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_posts"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_posts_status_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_posts_roommate_status_enum"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_posts_category_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "forum_banned_keywords"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."forum_banned_keywords_action_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_conversations_listing_student"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_conversations_landlord_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_conversations_student_id"
        `);
    await queryRunner.query(`
            DROP TABLE "conversations"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_messages_client_message"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_messages_conversation_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_messages_unread"
        `);
    await queryRunner.query(`
            DROP TABLE "messages"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."messages_type_enum"
        `);
    await queryRunner.query(`
            DROP TABLE "booking_events"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_bookings_listing_time"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_bookings_status_expires"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_bookings_user_status"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."uq_bookings_one_holding_per_listing"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_bookings_code"
        `);
    await queryRunner.query(`
            DROP TABLE "bookings"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."bookings_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listing_views_listing_created"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listing_views_listing_viewer_created"
        `);
    await queryRunner.query(`
            DROP TABLE "listing_views"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listing_reports_listing"
        `);
    await queryRunner.query(`
            DROP TABLE "listing_reports"
        `);
    await queryRunner.query(`
            DROP TABLE "amenities"
        `);
    await queryRunner.query(`
            DROP TABLE "listing_amenities"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_active_created_at"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_status"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_location"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_ward_code"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_province_code"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listings_owner_id"
        `);
    await queryRunner.query(`
            DROP TABLE "listings"
        `);
    await queryRunner.query(`
            DROP TYPE "public"."listings_status_enum"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_favorites_listing_id"
        `);
    await queryRunner.query(`
            DROP TABLE "favorites"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listing_universities_university"
        `);
    await queryRunner.query(`
            DROP TABLE "listing_universities"
        `);
    await queryRunner.query(`
            DROP TABLE "universities"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_listing_images_listing_id"
        `);
    await queryRunner.query(`
            DROP TABLE "listing_images"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_otp_codes_is_used"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_otp_codes_identifier"
        `);
    await queryRunner.query(`
            DROP TABLE "otp_codes"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_refresh_tokens_revoked"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_refresh_tokens_device_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_refresh_tokens_hash"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_refresh_tokens_user_id"
        `);
    await queryRunner.query(`
            DROP TABLE "refresh_tokens"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_users_role_id"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_users_phone"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_users_email"
        `);
    await queryRunner.query(`
            DROP TABLE "users"
        `);
    await queryRunner.query(`
            DROP TABLE "roles"
        `);
    await queryRunner.query(`
            DROP TABLE "role_permissions"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_permissions_module"
        `);
    await queryRunner.query(`
            DROP INDEX "public"."idx_permissions_code"
        `);
    await queryRunner.query(`
            DROP TABLE "permissions"
        `);
  }
}
