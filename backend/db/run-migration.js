import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

// Supabase direct connection (transaction mode)
const connectionString = `postgresql://postgres.yrerxvuyeglrypeufjpy:${process.env.SUPABASE_SERVICE_KEY}@aws-0-us-east-1.pooler.supabase.com:6543/postgres`;

async function migrate() {
  // Try direct connection with the database password from Supabase
  // Supabase projects use the project's database password, not the service key
  // Let's try using the Supabase REST API with a workaround instead
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;
  
  const sql = `
    CREATE TABLE IF NOT EXISTS notifications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      type VARCHAR(50) NOT NULL,
      title VARCHAR(255) NOT NULL,
      message TEXT,
      link VARCHAR(255),
      is_read BOOLEAN DEFAULT FALSE,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (is_read, created_at DESC);
  `;

  // Use Supabase's SQL API endpoint (available on newer versions)
  const endpoints = [
    `${supabaseUrl}/rest/v1/rpc/exec_sql`,
    `${supabaseUrl}/sql`,
  ];

  // First approach: create via a temporary RPC function
  // Create a helper function first, then call it, then drop it
  const createFnSql = `
    CREATE OR REPLACE FUNCTION _temp_create_notifications()
    RETURNS void AS $$
    BEGIN
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        type VARCHAR(50) NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT,
        link VARCHAR(255),
        is_read BOOLEAN DEFAULT FALSE,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications (is_read, created_at DESC);
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  // Step 1: Create the helper function via PostgREST's rpc
  // Actually PostgREST can't create functions either...
  
  // Let's try the Supabase Management API
  const mgmtRes = await fetch(`https://api.supabase.com/v1/projects/yrerxvuyeglrypeufjpy/database/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });
  
  if (mgmtRes.ok) {
    const result = await mgmtRes.json();
    console.log('✅ Table created via Management API:', result);
    return;
  }
  
  console.log('Management API status:', mgmtRes.status);
  const mgmtErr = await mgmtRes.text();
  console.log('Management API error:', mgmtErr);
  
  // Last resort: try connecting directly with pg
  console.log('\\nTrying direct PostgreSQL connection...');
  
  // Supabase connection pooler
  const client = new Client({
    host: 'aws-0-us-east-1.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.yrerxvuyeglrypeufjpy',
    password: process.env.SUPABASE_SERVICE_KEY,
    ssl: { rejectUnauthorized: false },
  });
  
  try {
    await client.connect();
    console.log('Connected to PostgreSQL!');
    
    await client.query(sql);
    console.log('✅ notifications table created successfully');
    
    // Also enable RLS
    await client.query('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;');
    console.log('✅ RLS enabled');
    
    await client.end();
  } catch (err) {
    console.log('PostgreSQL connection error:', err.message);
    console.log('\\n⚠️  Please run the following SQL in your Supabase SQL Editor:');
    console.log(sql);
    console.log('ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;');
  }
}

migrate().catch(console.error);
