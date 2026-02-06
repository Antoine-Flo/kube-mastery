CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_tier" text NOT NULL,
	"status" text NOT NULL,
	"paddle_subscription_id" text,
	"paddle_customer_id" text,
	"current_period_start" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"canceled_at" timestamp with time zone,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_paddle_subscription_id_unique" UNIQUE("paddle_subscription_id")
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"text" text NOT NULL,
	"lesson_id" text NOT NULL,
	"user_id" uuid,
	"visitor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "suggestions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "surveys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"responses" jsonb NOT NULL,
	"user_id" uuid,
	"visitor_id" text,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "surveys" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" text,
	"locale" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_preferences" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "user_progress" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"completed_lessons" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_progress" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suggestions" ADD CONSTRAINT "suggestions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "surveys" ADD CONSTRAINT "surveys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_progress" ADD CONSTRAINT "user_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscriptions_user_id_idx" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_paddle_subscription_id_idx" ON "subscriptions" USING btree ("paddle_subscription_id");--> statement-breakpoint
CREATE INDEX "suggestions_lesson_id_idx" ON "suggestions" USING btree ("lesson_id");--> statement-breakpoint
CREATE INDEX "suggestions_created_at_idx" ON "suggestions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "survey_name_idx" ON "surveys" USING btree ("name");--> statement-breakpoint
CREATE INDEX "survey_user_id_idx" ON "surveys" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "survey_visitor_id_idx" ON "surveys" USING btree ("visitor_id");--> statement-breakpoint
CREATE INDEX "survey_created_at_idx" ON "surveys" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_progress_user_id_idx" ON "user_progress" USING btree ("user_id");--> statement-breakpoint
CREATE POLICY "Users can view their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid())) WITH CHECK ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own subscriptions" ON "subscriptions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("subscriptions"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Allow public insert on suggestions" ON "suggestions" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Allow authenticated insert on suggestions" ON "suggestions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Allow public insert on survey" ON "surveys" AS PERMISSIVE FOR INSERT TO "anon" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Allow authenticated insert on survey" ON "surveys" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view their own responses" ON "surveys" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("surveys"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Allow service role to manage survey" ON "surveys" AS PERMISSIVE FOR ALL TO "service_role" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "Users can view their own preferences" ON "user_preferences" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own preferences" ON "user_preferences" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own preferences" ON "user_preferences" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid())) WITH CHECK ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own preferences" ON "user_preferences" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_preferences"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can view their own progress" ON "user_progress" AS PERMISSIVE FOR SELECT TO "authenticated" USING ("user_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can insert their own progress" ON "user_progress" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ("user_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can update their own progress" ON "user_progress" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ("user_progress"."user_id" = (select auth.uid())) WITH CHECK ("user_progress"."user_id" = (select auth.uid()));--> statement-breakpoint
CREATE POLICY "Users can delete their own progress" ON "user_progress" AS PERMISSIVE FOR DELETE TO "authenticated" USING ("user_progress"."user_id" = (select auth.uid()));