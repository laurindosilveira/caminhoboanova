
-- Remove duplicate empty account for Gustavo Widthauper Breunig
DELETE FROM user_roles WHERE user_id = '21c17b4b-6790-4b44-8bf6-558f08dca2bb';
DELETE FROM profiles WHERE user_id = '21c17b4b-6790-4b44-8bf6-558f08dca2bb';
