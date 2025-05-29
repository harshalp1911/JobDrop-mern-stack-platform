import React from 'react';

export default function Filters({
    location,
    setLocation,
    postedWithin,
    setPostedWithin,
    jobTypes,
    setJobTypes,
    experienceLevels,
    setExperienceLevels,
}) {
    const states = [
        'India', 'Andhra Pradesh', 'Karnataka', 'Maharashtra', 'Tamil Nadu', 'Gujarat', 'West Bengal', 'Telangana', 'Delhi', 'Haryana'
    ];
    const postedOptions = [
        { label: 'Last 1 hour', value: '1h' },
        { label: 'Last 24 hours', value: '24h' },
        { label: 'Last 7 days', value: '7d' },
        { label: 'Last 10 days', value: '10d' },
        { label: 'Last 20 days', value: '20d' },
        { label: 'Last 30 days', value: '30d' },
    ];
    const jobTypeOptions = [
        { label: 'Full-time', value: 'fulltime' },
        { label: 'Internship', value: 'internship' },
    ];
    const expOptions = [
        { label: 'Fresher', value: 'fresher' },
        { label: 'Entry Level', value: 'entryLevel' },
        { label: 'Experienced', value: 'experienced' },
    ];

    const toggle = (val, arr, setFn) =>
        setFn(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);

    return (
        <div style={{ margin: '1.5rem 0' }}>
            <label>
                State:{' '}
                <select
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                >
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </label>

            <label style={{ marginLeft: 20 }}>
                Posted Within:{' '}
                <select
                    value={postedWithin}
                    onChange={e => setPostedWithin(e.target.value)}
                >
                    {postedOptions.map(o => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </label>

            <fieldset style={{ margin: '1rem 0' }}>
                <legend>Job Type</legend>
                {jobTypeOptions.map(o => (
                    <label key={o.value} style={{ marginRight: 10 }}>
                        <input
                            type="checkbox"
                            checked={jobTypes.includes(o.value)}
                            onChange={() => toggle(o.value, jobTypes, setJobTypes)}
                        />{' '}
                        {o.label}
                    </label>
                ))}
            </fieldset>

            <fieldset style={{ margin: '1rem 0' }}>
                <legend>Experience Level</legend>
                {expOptions.map(o => (
                    <label key={o.value} style={{ marginRight: 10 }}>
                        <input
                            type="checkbox"
                            checked={experienceLevels.includes(o.value)}
                            onChange={() => toggle(o.value, experienceLevels, setExperienceLevels)}
                        />{' '}
                        {o.label}
                    </label>
                ))}
            </fieldset>
        </div>
    );
}
