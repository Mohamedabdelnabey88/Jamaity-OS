/** Quote PostgREST filter values so punctuation cannot introduce another filter. */
export function journalSearchFilter(query: string) {
 const pattern = '%'+query.trim().replace(/[\\%_]/g,'\\$&')+'%';
 const quoted = '"'+pattern.replace(/\\/g,'\\\\').replace(/"/g,'\\"')+'"';
 return `description.ilike.${quoted},reference_type.ilike.${quoted}`;
}
