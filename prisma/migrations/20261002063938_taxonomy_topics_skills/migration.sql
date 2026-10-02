-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "countsForAnalytics" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "TopicSection" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TopicSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillNode" (
    "id" TEXT NOT NULL,
    "orgId" TEXT,
    "sectionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "aliases" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SkillNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionTopic" (
    "questionId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,

    CONSTRAINT "QuestionTopic_pkey" PRIMARY KEY ("questionId")
);

-- CreateTable
CREATE TABLE "QuestionSkill" (
    "questionId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,

    CONSTRAINT "QuestionSkill_pkey" PRIMARY KEY ("questionId","skillId")
);

-- CreateIndex
CREATE INDEX "TopicSection_orgId_idx" ON "TopicSection"("orgId");

-- CreateIndex
CREATE INDEX "SkillNode_sectionId_idx" ON "SkillNode"("sectionId");

-- CreateIndex
CREATE INDEX "SkillNode_orgId_idx" ON "SkillNode"("orgId");

-- CreateIndex
CREATE INDEX "QuestionTopic_sectionId_idx" ON "QuestionTopic"("sectionId");

-- CreateIndex
CREATE INDEX "QuestionSkill_skillId_idx" ON "QuestionSkill"("skillId");

-- AddForeignKey
ALTER TABLE "TopicSection" ADD CONSTRAINT "TopicSection_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TopicSection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillNode" ADD CONSTRAINT "SkillNode_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionTopic" ADD CONSTRAINT "QuestionTopic_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "TopicSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkill" ADD CONSTRAINT "QuestionSkill_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionSkill" ADD CONSTRAINT "QuestionSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillNode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================
-- Platform taxonomy spine (orgId NULL): shared by every college so
-- strengths/weaknesses mean the same thing everywhere. Fixed ids keep
-- every environment identical; ON CONFLICT keeps re-runs harmless.
-- ============================================================
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_dsa', NULL, 'Data Structures & Algorithms', 'DSA', 'Core problem-solving: data structures, algorithms and complexity.', 0) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_arrays', NULL, 'topic_dsa', 'Arrays', 'DSA.ARRAYS', ARRAY['array', 'arrays']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_strings', NULL, 'topic_dsa', 'Strings', 'DSA.STRINGS', ARRAY['string', 'strings']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_linked_lists', NULL, 'topic_dsa', 'Linked Lists', 'DSA.LINKED_LISTS', ARRAY['linked list', 'linked lists', 'll']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_stacks_queues', NULL, 'topic_dsa', 'Stacks & Queues', 'DSA.STACKS_QUEUES', ARRAY['queue', 'stack', 'stacks & queues']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_trees', NULL, 'topic_dsa', 'Trees', 'DSA.TREES', ARRAY['binary tree', 'bst', 'tree', 'trees']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_graphs', NULL, 'topic_dsa', 'Graphs', 'DSA.GRAPHS', ARRAY['bfs', 'dfs', 'graph', 'graphs']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_dynamic_programming', NULL, 'topic_dsa', 'Dynamic Programming', 'DSA.DYNAMIC_PROGRAMMING', ARRAY['dp', 'dynamic programming']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_sorting_searching', NULL, 'topic_dsa', 'Sorting & Searching', 'DSA.SORTING_SEARCHING', ARRAY['binary search', 'searching', 'sorting', 'sorting & searching']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_recursion_backtracking', NULL, 'topic_dsa', 'Recursion & Backtracking', 'DSA.RECURSION_BACKTRACKING', ARRAY['backtracking', 'recursion', 'recursion & backtracking']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_hashing', NULL, 'topic_dsa', 'Hashing', 'DSA.HASHING', ARRAY['hash table', 'hashing', 'hashmap']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_greedy', NULL, 'topic_dsa', 'Greedy', 'DSA.GREEDY', ARRAY['greedy', 'greedy algorithms']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dsa_time_space_complexity', NULL, 'topic_dsa', 'Time & Space Complexity', 'DSA.TIME_SPACE_COMPLEXITY', ARRAY['big o', 'complexity', 'time & space complexity', 'time complexity']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_dbms', NULL, 'Database Management Systems', 'DBMS', 'Relational databases and SQL.', 1) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_sql_queries', NULL, 'topic_dbms', 'SQL Queries', 'DBMS.SQL_QUERIES', ARRAY['sql', 'sql queries']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_sql_joins', NULL, 'topic_dbms', 'SQL Joins', 'DBMS.SQL_JOINS', ARRAY['join', 'joins', 'sql joins']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_normalization', NULL, 'topic_dbms', 'Normalization', 'DBMS.NORMALIZATION', ARRAY['normal forms', 'normalisation', 'normalization']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_transactions_acid', NULL, 'topic_dbms', 'Transactions & ACID', 'DBMS.TRANSACTIONS_ACID', ARRAY['acid', 'transactions', 'transactions & acid']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_indexing', NULL, 'topic_dbms', 'Indexing', 'DBMS.INDEXING', ARRAY['index', 'indexes', 'indexing']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_dbms_er_modelling', NULL, 'topic_dbms', 'ER Modelling', 'DBMS.ER_MODELLING', ARRAY['er diagram', 'er model', 'er modelling']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_os', NULL, 'Operating Systems', 'OS', 'How operating systems manage processes, memory and storage.', 2) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_processes_threads', NULL, 'topic_os', 'Processes & Threads', 'OS.PROCESSES_THREADS', ARRAY['process', 'processes & threads', 'thread', 'threads']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_cpu_scheduling', NULL, 'topic_os', 'CPU Scheduling', 'OS.CPU_SCHEDULING', ARRAY['cpu scheduling', 'scheduling']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_memory_management', NULL, 'topic_os', 'Memory Management', 'OS.MEMORY_MANAGEMENT', ARRAY['memory management', 'paging', 'virtual memory']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_deadlocks', NULL, 'topic_os', 'Deadlocks', 'OS.DEADLOCKS', ARRAY['deadlock', 'deadlocks']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_synchronization', NULL, 'topic_os', 'Synchronization', 'OS.SYNCHRONIZATION', ARRAY['mutex', 'semaphores', 'synchronization']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_os_file_systems', NULL, 'topic_os', 'File Systems', 'OS.FILE_SYSTEMS', ARRAY['file system', 'file systems']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_cn', NULL, 'Computer Networks', 'CN', 'Networking models, protocols and addressing.', 3) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_osi_tcp_ip_models', NULL, 'topic_cn', 'OSI & TCP/IP Models', 'CN.OSI_TCP_IP_MODELS', ARRAY['osi', 'osi & tcp/ip models', 'osi model']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_ip_addressing_subnetting', NULL, 'topic_cn', 'IP Addressing & Subnetting', 'CN.IP_ADDRESSING_SUBNETTING', ARRAY['ip addressing', 'ip addressing & subnetting', 'subnetting']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_tcp_udp', NULL, 'topic_cn', 'TCP & UDP', 'CN.TCP_UDP', ARRAY['tcp', 'tcp & udp', 'udp']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_http_dns', NULL, 'topic_cn', 'HTTP & DNS', 'CN.HTTP_DNS', ARRAY['dns', 'http', 'http & dns']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_routing', NULL, 'topic_cn', 'Routing', 'CN.ROUTING', ARRAY['routing', 'routing protocols']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_cn_network_security', NULL, 'topic_cn', 'Network Security', 'CN.NETWORK_SECURITY', ARRAY['network security', 'security', 'ssl', 'tls']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_oop', NULL, 'Object-Oriented Programming', 'OOP', 'Object-oriented design and its principles.', 4) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_oop_classes_objects', NULL, 'topic_oop', 'Classes & Objects', 'OOP.CLASSES_OBJECTS', ARRAY['class', 'classes & objects', 'object']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_oop_inheritance', NULL, 'topic_oop', 'Inheritance', 'OOP.INHERITANCE', ARRAY['inheritance']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_oop_polymorphism', NULL, 'topic_oop', 'Polymorphism', 'OOP.POLYMORPHISM', ARRAY['overloading', 'overriding', 'polymorphism']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_oop_encapsulation_abstraction', NULL, 'topic_oop', 'Encapsulation & Abstraction', 'OOP.ENCAPSULATION_ABSTRACTION', ARRAY['abstraction', 'encapsulation', 'encapsulation & abstraction']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_oop_design_principles', NULL, 'topic_oop', 'Design Principles', 'OOP.DESIGN_PRINCIPLES', ARRAY['design patterns', 'design principles', 'solid']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_apt', NULL, 'Quantitative Aptitude', 'APT', 'Numerical ability for placement tests.', 5) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_percentages', NULL, 'topic_apt', 'Percentages', 'APT.PERCENTAGES', ARRAY['percentage', 'percentages']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_profit_loss', NULL, 'topic_apt', 'Profit & Loss', 'APT.PROFIT_LOSS', ARRAY['profit & loss', 'profit and loss']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_ratio_proportion', NULL, 'topic_apt', 'Ratio & Proportion', 'APT.RATIO_PROPORTION', ARRAY['ratio', 'ratio & proportion']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_time_work', NULL, 'topic_apt', 'Time & Work', 'APT.TIME_WORK', ARRAY['time & work', 'time and work']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_time_speed_distance', NULL, 'topic_apt', 'Time, Speed & Distance', 'APT.TIME_SPEED_DISTANCE', ARRAY['speed distance', 'time, speed & distance', 'tsd']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_probability', NULL, 'topic_apt', 'Probability', 'APT.PROBABILITY', ARRAY['probability']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_permutations_combinations', NULL, 'topic_apt', 'Permutations & Combinations', 'APT.PERMUTATIONS_COMBINATIONS', ARRAY['combination', 'permutation', 'permutations & combinations', 'pnc']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_number_system', NULL, 'topic_apt', 'Number System', 'APT.NUMBER_SYSTEM', ARRAY['number system', 'numbers']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_averages', NULL, 'topic_apt', 'Averages', 'APT.AVERAGES', ARRAY['average', 'averages']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_apt_simple_compound_interest', NULL, 'topic_apt', 'Simple & Compound Interest', 'APT.SIMPLE_COMPOUND_INTEREST', ARRAY['ci', 'interest', 'si', 'simple & compound interest']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_lr', NULL, 'Logical Reasoning', 'LR', 'Reasoning and puzzles.', 6) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_series', NULL, 'topic_lr', 'Series', 'LR.SERIES', ARRAY['number series', 'series']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_coding_decoding', NULL, 'topic_lr', 'Coding-Decoding', 'LR.CODING_DECODING', ARRAY['coding decoding', 'coding-decoding']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_blood_relations', NULL, 'topic_lr', 'Blood Relations', 'LR.BLOOD_RELATIONS', ARRAY['blood relation', 'blood relations']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_seating_arrangement', NULL, 'topic_lr', 'Seating Arrangement', 'LR.SEATING_ARRANGEMENT', ARRAY['arrangement', 'seating arrangement']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_syllogisms', NULL, 'topic_lr', 'Syllogisms', 'LR.SYLLOGISMS', ARRAY['syllogism', 'syllogisms']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_puzzles', NULL, 'topic_lr', 'Puzzles', 'LR.PUZZLES', ARRAY['puzzle', 'puzzles']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_data_interpretation', NULL, 'topic_lr', 'Data Interpretation', 'LR.DATA_INTERPRETATION', ARRAY['data interpretation', 'di']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_lr_direction_sense', NULL, 'topic_lr', 'Direction Sense', 'LR.DIRECTION_SENSE', ARRAY['direction sense', 'directions']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_verbal', NULL, 'Verbal Ability', 'VERBAL', 'English comprehension and usage.', 7) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_verbal_reading_comprehension', NULL, 'topic_verbal', 'Reading Comprehension', 'VERBAL.READING_COMPREHENSION', ARRAY['rc', 'reading comprehension']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_verbal_grammar', NULL, 'topic_verbal', 'Grammar', 'VERBAL.GRAMMAR', ARRAY['grammar']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_verbal_vocabulary', NULL, 'topic_verbal', 'Vocabulary', 'VERBAL.VOCABULARY', ARRAY['antonyms', 'synonyms', 'vocabulary']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_verbal_sentence_correction', NULL, 'topic_verbal', 'Sentence Correction', 'VERBAL.SENTENCE_CORRECTION', ARRAY['error spotting', 'sentence correction']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_verbal_para_jumbles', NULL, 'topic_verbal', 'Para Jumbles', 'VERBAL.PARA_JUMBLES', ARRAY['para jumbles', 'parajumbles']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "TopicSection" ("id", "orgId", "name", "code", "description", "order") VALUES ('topic_coding', NULL, 'Programming & Coding', 'CODING', 'Writing correct, efficient programs.', 8) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_coding_problem_solving', NULL, 'topic_coding', 'Problem Solving', 'CODING.PROBLEM_SOLVING', ARRAY['problem solving']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_coding_implementation', NULL, 'topic_coding', 'Implementation', 'CODING.IMPLEMENTATION', ARRAY['implementation']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_coding_debugging', NULL, 'topic_coding', 'Debugging', 'CODING.DEBUGGING', ARRAY['debugging']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
INSERT INTO "SkillNode" ("id", "orgId", "sectionId", "name", "code", "aliases") VALUES ('skill_coding_code_optimization', NULL, 'topic_coding', 'Code Optimization', 'CODING.CODE_OPTIMIZATION', ARRAY['code optimization', 'optimization']::TEXT[]) ON CONFLICT ("id") DO NOTHING;
