import React from 'react';
import Skeleton from '../ui/Skeleton';
import '../ui/Skeleton.css'; // Ensure styles are loaded

const HomePageSkeleton = () => {
    return (
        <div className="home-page layout-container animate-pulse">
            {/* Market Summary Section */}
            <section className="market-overview mb-12">
                <div className="section-header mb-5 flex justify-between items-center">
                    <Skeleton variant="text" width={200} height={32} className="mb-2" />
                </div>

                {/* 4 Cards Grid */}
                <div className="market-cards grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="summary-card p-6 rounded-xl border border-gray-100 bg-white/70 h-32 flex flex-col justify-between">
                            <Skeleton variant="text" width="60%" height={16} className="mb-4" />
                            <Skeleton variant="text" width="80%" height={36} />
                        </div>
                    ))}
                </div>

                {/* Market Breadth Bar */}
                <div className="mt-8">
                    <Skeleton variant="rectangular" width="100%" height={12} className="rounded-full" />
                    <div className="flex justify-between mt-2">
                        <Skeleton variant="text" width={60} height={20} />
                        <Skeleton variant="text" width={60} height={20} />
                        <Skeleton variant="text" width={60} height={20} />
                    </div>
                </div>
            </section>

            {/* Sector Chart Section */}
            <section className="mb-12">
                <Skeleton variant="text" width={180} height={24} className="mb-4" />
                <div className="bg-white p-6 rounded-xl border border-gray-100 h-96">
                    <Skeleton variant="rectangular" width="100%" height="100%" />
                </div>
            </section>

            {/* Trending Bar */}
            <section className="mb-12">
                <Skeleton variant="rectangular" width="100%" height={80} className="rounded-xl" />
            </section>

            {/* Stocks Table Section */}
            <section className="stocks-section">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <Skeleton variant="text" width={150} height={32} />
                    <div className="flex gap-3 w-full md:w-auto">
                        <Skeleton variant="rectangular" width={100} height={40} className="rounded-full" />
                        <Skeleton variant="rectangular" width={180} height={40} className="rounded-md" />
                    </div>
                </div>

                {/* Mock Table */}
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-6 p-4 border-b border-gray-100 bg-gray-50/50">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <Skeleton key={i} variant="text" width="60%" height={20} />
                        ))}
                    </div>
                    {/* Table Rows */}
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((row) => (
                        <div key={row} className="grid grid-cols-6 p-4 border-b border-gray-50 items-center">
                            <div className="flex items-center gap-3">
                                <Skeleton variant="circular" width={32} height={32} />
                                <Skeleton variant="text" width={60} height={20} />
                            </div>
                            <Skeleton variant="text" width="40%" height={20} />
                            <Skeleton variant="text" width="40%" height={20} />
                            <Skeleton variant="text" width="40%" height={20} />
                            <Skeleton variant="text" width="40%" height={20} />
                            <div className="flex justify-end">
                                <Skeleton variant="rectangular" width={24} height={24} />
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default HomePageSkeleton;
