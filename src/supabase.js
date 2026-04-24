import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://bmeegznpqmmhcvltsgup.supabase.co'
const supabaseKey = 'sb_publishable_7amCeosyNafBLIogLNX68g_c01o2vu6'

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
)