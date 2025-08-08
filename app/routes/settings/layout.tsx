import { Outlet } from "react-router";
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs';
import { LoaderPinwheel, SlidersHorizontal, UserRound } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '~/components/ui/button';
import { ArrowLeft } from 'lucide-react';

export default function SettingsLayout() {
    return (
        <div className="w-full min-h-screen bg-background">
            <div className="w-full 2xl:max-w-4xl lg:max-w-3xl mx-auto flex flex-col h-full px-5 md:px-0 py-4">
                <Link to="/chat/i"><Button variant="ghost" size="sm"><ArrowLeft /> Back to Chat</Button></Link>
                <p className="text-2xl font-bold my-4">Settings</p>
                <Tabs defaultValue="profile" className="text-sm text-muted-foreground">
                    <TabsList variant="line">
                        <Link to="/settings">
                            <TabsTrigger value="profile">
                                <UserRound /> Profile
                            </TabsTrigger>
                        </Link>
                        <Link to="/settings/customize">
                            <TabsTrigger value="customization">
                                <SlidersHorizontal /> Customization
                            </TabsTrigger>
                        </Link>
                        <Link to="/settings/model">
                            <TabsTrigger value="model">
                                <LoaderPinwheel />
                                Models
                            </TabsTrigger>
                        </Link>
                    </TabsList>
                    <TabsContent value="profile"><Outlet /></TabsContent>
                    <TabsContent value="customization"><Outlet /></TabsContent>
                    <TabsContent value="model"><Outlet /></TabsContent>
                </Tabs>
            </div>
        </div>)
}
