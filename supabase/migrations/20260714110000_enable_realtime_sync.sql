/*
# FinanceHub — Enable Realtime Sync (v1.7.1)

Mengaktifkan Supabase Realtime pada tabel-tabel utama supaya perubahan data
(termasuk dari Telegram bot) langsung tersinkron ke aplikasi tanpa perlu
reload manual.
*/

ALTER PUBLICATION supabase_realtime ADD TABLE personal_business;
ALTER PUBLICATION supabase_realtime ADD TABLE personal_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE group_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE member_transaction_details;
ALTER PUBLICATION supabase_realtime ADD TABLE capital_additions;
ALTER PUBLICATION supabase_realtime ADD TABLE withdrawals;
