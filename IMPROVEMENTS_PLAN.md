# Improvements Plan

## Completed ✅
1. Created batch API route (`/api/migrate-batch`) with:
   - Faster rate limiting (250ms = 4 req/sec)
   - Better error messages with actionable information
   - Batch processing capability
   - Enhanced error context (retryable flags, error types)

2. Added CSS for progress bars and error display

## To Implement

### 1. Progress Bars
- Export: Show progress when fetching promotions and codes
- Migration: Real-time progress bar showing X/Y processed

### 2. Batch Processing for Migration
- Process codes in batches of 50
- Update progress after each batch
- Continue processing even if batch has errors

### 3. Enhanced Error Display
- Show errors in a scrollable list
- Each error shows: Code, Error message, Error type
- Retry button for retryable errors
- Group errors by type (network, validation, etc.)

### 4. Speed Improvements
- Reduced delay from 500ms to 250ms (2x faster)
- Batch processing reduces overhead

### 5. Troubleshooting Features
- Error details with API response codes
- Actionable error messages
- Retry functionality for failed items
- Export error list to CSV/JSON

## Implementation Notes

The migrate page needs to:
- Use `/api/migrate-batch` endpoint
- Process in batches of 50 codes
- Update progress state after each batch
- Display progress bar with percentage
- Show errors as they occur
- Allow retry of failed items
