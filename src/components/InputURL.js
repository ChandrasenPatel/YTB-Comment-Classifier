import React, { useState } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";

export default function InputURL() {
    const [url, setUrl] = useState("");
    const [demoData, setDemoData] = useState(null);
    const [realData, setRealData] = useState(null);
    const [demoLoading, setDemoLoading] = useState(false);
    const [realLoading, setRealLoading] = useState(false);

    const COLORS = ["#22c55e", "#ef4444", "#6b7280", "#eab308", "#a855f7"];

    const makeChartData = (section) =>
        section
            ? [
                { name: "Positive", value: section.positive || 0 },
                { name: "Negative", value: section.negative || 0 },
                { name: "Neutral", value: section.neutral || 0 },
                { name: "Spam", value: section.spam || 0 },
                { name: "Abusive", value: section.abusive || 0 },
            ]
            : [];

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!url.trim()) {
            alert("Invalid Youtube URL");
            return;
        }

        setDemoData(null);
        setRealData(null);

        try {
            // 1) demo first
            setDemoLoading(true);

            const demoResponse = await fetch("http://localhost:5000/classify-demo", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });

            const demoResult = await demoResponse.json();
            console.log("demoResult:", demoResult);

            if (!demoResponse.ok) {
                alert(demoResult.error || "Demo failed");
                setDemoLoading(false);
                return;
            }

            setDemoData(demoResult);
            setDemoLoading(false);

            // 2) real second
            setRealLoading(true);

            const realResponse = await fetch("http://localhost:5000/classify-real", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ url }),
            });

            const realResult = await realResponse.json();
            console.log("realResult:", realResult);

            if (!realResponse.ok) {
                alert(realResult.error || "Real API failed");
                setRealLoading(false);
                return;
            }

            setRealData(realResult);
        } catch (error) {
            console.log("Error", error);
            alert("Server error");
        } finally {
            setDemoLoading(false);
            setRealLoading(false);
        }
    };

    const SectionCard = ({ title, totalComments, section }) => {
        const chartData = makeChartData(section);

        return (
            <div className="m-5 space-y-2 flex flex-col border-2 rounded p-4">
                <div className="text-center">
                    <h1 className="text-4xl">{title}</h1>
                </div>

                <div className="flex justify-center gap-4 mb-4 flex-wrap">
                    <div className="p-3 border rounded shadow">
                        <p className="font-bold">Total</p>
                        <p>{totalComments || 0}</p>
                    </div>

                    <div className="p-3 border rounded shadow text-green-600">
                        <p className="font-bold">Positive</p>
                        <p>{section?.positive || 0}</p>
                    </div>

                    <div className="p-3 border rounded shadow text-red-600">
                        <p className="font-bold">Negative</p>
                        <p>{section?.negative || 0}</p>
                    </div>

                    <div className="p-3 border rounded shadow text-gray-600">
                        <p className="font-bold">Neutral</p>
                        <p>{section?.neutral || 0}</p>
                    </div>

                    <div className="p-3 border rounded shadow text-yellow-600">
                        <p className="font-bold">Spam</p>
                        <p>{section?.spam || 0}</p>
                    </div>

                    <div className="p-3 border rounded shadow text-purple-600">
                        <p className="font-bold">Abusive</p>
                        <p>{section?.abusive || 0}</p>
                    </div>
                </div>

                <div className="flex justify-center mt-6">
                    <PieChart width={320} height={320}>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={index}
                                    fill={COLORS[index % COLORS.length]}
                                />
                            ))}
                        </Pie>
                        <Tooltip />
                        <Legend />
                    </PieChart>
                </div>
            </div>
        );
    };

    return (
        <>
            <form onSubmit={handleSubmit} className="text-center">
                <input
                    className="border rounded-sm p-2 mt-10 text-white"
                    type="text"
                    placeholder="Enter youtube URL"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                />

                <br /><br />

                <button
                    className="border rounded-sm px-4 py-1 hover:border-gray-500 bg-white active:bg-blue-500 active:text-white active:scale-95 transition"
                    type="submit"
                >
                    Submit
                </button>
            </form>

            {demoLoading && <p className="text-center mt-4">Demo classification loading...</p>}
            {demoData && (
                <SectionCard
                    title="Demo Classifier"
                    totalComments={demoData.totalComments}
                    section={demoData.demoSection}
                />
            )}

            {realLoading && <p className="text-center mt-4">Real API classification loading...</p>}
            {realData && (
                <SectionCard
                    title="Real API Classifier"
                    totalComments={realData.totalComments}
                    section={realData.realSection}
                />
            )}
        </>
    );
}