export const idlFactory = ({ IDL }) => {
  const AddAudioRequest = IDL.Record({
    'audio_data' : IDL.Vec(IDL.Nat8),
    'meeting_id' : IDL.Text,
    'timestamp' : IDL.Opt(IDL.Nat64),
  });
  const AddAudioResponse = IDL.Record({
    'status' : IDL.Text,
    'queue_size' : IDL.Nat32,
    'chunk_id' : IDL.Text,
  });
  const Result = IDL.Variant({ 'Ok' : AddAudioResponse, 'Err' : IDL.Text });
  const EndMeetingRequest = IDL.Record({ 'meeting_id' : IDL.Text });
  const EndMeetingResponse = IDL.Record({
    'status' : IDL.Text,
    'meeting_id' : IDL.Text,
    'summary' : IDL.Opt(IDL.Text),
    'total_segments' : IDL.Nat32,
  });
  const Result_1 = IDL.Variant({ 'Ok' : EndMeetingResponse, 'Err' : IDL.Text });
  const TranscriptSegment = IDL.Record({
    'text' : IDL.Text,
    'chunk_id' : IDL.Text,
    'timestamp' : IDL.Nat64,
    'confidence' : IDL.Opt(IDL.Float32),
  });
  const MeetingStatus = IDL.Variant({
    'Ended' : IDL.Null,
    'Active' : IDL.Null,
    'AutoEnded' : IDL.Null,
  });
  const Meeting = IDL.Record({
    'transcript_segments' : IDL.Vec(TranscriptSegment),
    'status' : MeetingStatus,
    'title' : IDL.Opt(IDL.Text),
    'meeting_id' : IDL.Text,
    'owner' : IDL.Principal,
    'created_at' : IDL.Nat64,
    'summary' : IDL.Opt(IDL.Text),
    'last_activity' : IDL.Nat64,
    'ended_at' : IDL.Opt(IDL.Nat64),
  });
  const Result_2 = IDL.Variant({ 'Ok' : Meeting, 'Err' : IDL.Text });
  const MeetingSummary = IDL.Record({
    'status' : MeetingStatus,
    'title' : IDL.Opt(IDL.Text),
    'meeting_id' : IDL.Text,
    'created_at' : IDL.Nat64,
    'has_summary' : IDL.Bool,
    'ended_at' : IDL.Opt(IDL.Nat64),
    'segment_count' : IDL.Nat32,
  });
  const StartMeetingRequest = IDL.Record({ 'title' : IDL.Opt(IDL.Text) });
  const StartMeetingResponse = IDL.Record({
    'status' : IDL.Text,
    'meeting_id' : IDL.Text,
  });
  const Result_3 = IDL.Variant({
    'Ok' : StartMeetingResponse,
    'Err' : IDL.Text,
  });
  const HttpHeader = IDL.Record({ 'value' : IDL.Text, 'name' : IDL.Text });
  const HttpResponse = IDL.Record({
    'status' : IDL.Nat,
    'body' : IDL.Vec(IDL.Nat8),
    'headers' : IDL.Vec(HttpHeader),
  });
  const TransformArgs = IDL.Record({
    'context' : IDL.Vec(IDL.Nat8),
    'response' : HttpResponse,
  });
  return IDL.Service({
    'add_audio' : IDL.Func([AddAudioRequest], [Result], []),
    'cleanup_old_data' : IDL.Func([], [IDL.Text], []),
    'end_meeting' : IDL.Func([EndMeetingRequest], [Result_1], []),
    'get_meeting' : IDL.Func([IDL.Text], [Result_2], ['query']),
    'get_meetings' : IDL.Func(
        [IDL.Opt(IDL.Nat32), IDL.Opt(IDL.Nat32)],
        [IDL.Vec(MeetingSummary)],
        ['query'],
      ),
    'get_queue_stats' : IDL.Func(
        [],
        [IDL.Nat64, IDL.Nat64, IDL.Nat64],
        ['query'],
      ),
    'get_storage_stats' : IDL.Func([], [IDL.Nat64, IDL.Nat64], ['query']),
    'health_check' : IDL.Func(
        [],
        [IDL.Vec(IDL.Tuple(IDL.Text, IDL.Text))],
        ['query'],
      ),
    'periodic_maintenance' : IDL.Func([], [IDL.Text], []),
    'start_meeting' : IDL.Func([StartMeetingRequest], [Result_3], []),
    'transform_openai_response' : IDL.Func(
        [TransformArgs],
        [HttpResponse],
        ['query'],
      ),
  });
};
export const init = ({ IDL }) => { return []; };
